import { Router } from 'express';
import pool from '../db/pool.js';
import { adjustStock } from '../services/inventory.js';

const router = Router();

router.get('/inventory', async (req, res) => {
  try {
    const forEdit = req.query.for_edit === 'true';
    const conditions = ['1=1'];
    const params = [];

    if (!forEdit) {
      conditions.push('inv.quantity > 0');
    }

    if (req.query.product_id) {
      const productId = parseInt(req.query.product_id, 10);
      if (Number.isFinite(productId)) {
        params.push(productId);
        conditions.push(`inv.product_id = $${params.length}`);
      }
    }

    if (req.query.category_id) {
      params.push(req.query.category_id);
      conditions.push(`p.category_id = $${params.length}`);
    }

    let query = `
      SELECT inv.id, inv.product_id, inv.size, inv.quantity,
        p.name as product_name, p.sku, p.min_stock_level, p.unit_price, p.image_url,
        c.id as category_id, c.name as category_name, c.color_code
      FROM inventory_stock inv
      JOIN products p ON p.id = inv.product_id
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE ${conditions.join(' AND ')}
    `;
    query += ' ORDER BY c.name, p.name, inv.size';
    const { rows } = await pool.query(query, params);

    const enriched = rows.map((r) => ({
      ...r,
      is_low_stock: r.quantity <= r.min_stock_level,
    }));
    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/transactions', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT st.*, p.name as product_name, p.sku, c.name as category_name,
        u.full_name as created_by_name
      FROM stock_transactions st
      JOIN products p ON p.id = st.product_id
      LEFT JOIN categories c ON c.id = p.category_id
      LEFT JOIN users u ON u.id = st.created_by
      ORDER BY st.created_at DESC
      LIMIT 100
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/in', async (req, res) => {
  const client = await pool.connect();
  try {
    const { product_id, size, quantity, notes, created_by } = req.body;
    if (!size) return res.status(400).json({ error: 'Size is required' });
    await client.query('BEGIN');
    const row = await adjustStock(client, {
      product_id,
      size,
      quantity: +quantity,
      type: 'stock_in',
      notes,
      created_by,
    });
    await client.query('COMMIT');
    res.status(201).json(row);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

router.post('/out', async (req, res) => {
  const client = await pool.connect();
  try {
    const { product_id, size, quantity, notes, created_by } = req.body;
    if (!size) return res.status(400).json({ error: 'Size is required' });
    await client.query('BEGIN');
    const row = await adjustStock(client, {
      product_id,
      size,
      quantity: -Math.abs(+quantity),
      type: 'stock_out',
      notes,
      created_by,
    });
    await client.query('COMMIT');
    res.status(201).json(row);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

export default router;
