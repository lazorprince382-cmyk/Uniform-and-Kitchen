import { Router } from 'express';
import pool from '../db/pool.js';
import { adjustStock } from '../services/inventory.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT o.*,
        par.full_name as parent_name,
        par.phone as parent_phone,
        st.full_name as student_name,
        st.class_grade,
        st.section
      FROM orders o
      LEFT JOIN parents par ON par.id = o.parent_id
      LEFT JOIN students st ON st.id = o.student_id
      ORDER BY o.created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/items/:itemId', async (req, res) => {
  const client = await pool.connect();
  try {
    const { size, quantity } = req.body;
    const { rows: [item] } = await client.query(
      `SELECT oi.*, o.status
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       WHERE oi.id = $1`,
      [req.params.itemId]
    );
    if (!item) return res.status(404).json({ error: 'Item not found' });

    const newSize = String(size ?? item.size ?? '').trim();
    const newQty = Math.max(1, parseInt(quantity, 10) || item.quantity);
    if (!newSize) return res.status(400).json({ error: 'Size is required' });

    await client.query('BEGIN');

    if (item.status === 'completed') {
      if (item.size !== newSize) {
        await adjustStock(client, {
          product_id: item.product_id,
          size: item.size,
          quantity: item.quantity,
          type: 'return',
          notes: 'Issuance edit',
          reference_type: 'issuance_edit',
          reference_id: item.order_id,
        });
        await adjustStock(client, {
          product_id: item.product_id,
          size: newSize,
          quantity: -newQty,
          type: 'issuance',
          notes: 'Issuance edit',
          reference_type: 'issuance_edit',
          reference_id: item.order_id,
        });
      } else {
        const diff = newQty - item.quantity;
        if (diff !== 0) {
          await adjustStock(client, {
            product_id: item.product_id,
            size: newSize,
            quantity: -diff,
            type: diff > 0 ? 'issuance' : 'return',
            notes: 'Issuance edit',
            reference_type: 'issuance_edit',
            reference_id: item.order_id,
          });
        }
      }
    }

    await client.query(
      `UPDATE order_items SET size = $1, quantity = $2, subtotal = 0 WHERE id = $3`,
      [newSize, newQty, item.id]
    );

    const { rows: sumRows } = await client.query(
      `SELECT COALESCE(SUM(quantity * unit_price), 0) as total FROM order_items WHERE order_id = $1`,
      [item.order_id]
    );
    await client.query(`UPDATE orders SET total_amount = $1, updated_at = NOW() WHERE id = $2`, [
      sumRows[0].total,
      item.order_id,
    ]);

    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

router.delete('/items/:itemId', async (req, res) => {
  const client = await pool.connect();
  try {
    const { rows: [item] } = await client.query(
      `SELECT oi.*, o.status
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       WHERE oi.id = $1`,
      [req.params.itemId]
    );
    if (!item) return res.status(404).json({ error: 'Item not found' });

    await client.query('BEGIN');

    if (item.status === 'completed') {
      await adjustStock(client, {
        product_id: item.product_id,
        size: item.size,
        quantity: item.quantity,
        type: 'return',
        notes: 'Issuance removed',
        reference_type: 'issuance_delete',
        reference_id: item.order_id,
      });
    }

    await client.query('DELETE FROM order_items WHERE id = $1', [item.id]);

    const { rows: remaining } = await client.query(
      'SELECT COUNT(*)::int as n FROM order_items WHERE order_id = $1',
      [item.order_id]
    );
    if (remaining[0].n === 0) {
      await client.query(`DELETE FROM orders WHERE id = $1`, [item.order_id]);
    } else {
      const { rows: sumRows } = await client.query(
        `SELECT COALESCE(SUM(quantity * unit_price), 0) as total FROM order_items WHERE order_id = $1`,
        [item.order_id]
      );
      await client.query(`UPDATE orders SET total_amount = $1, updated_at = NOW() WHERE id = $2`, [
        sumRows[0].total,
        item.order_id,
      ]);
    }

    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows: order } = await pool.query(
      `SELECT o.*, par.full_name as parent_name, st.full_name as student_name, st.class_grade
       FROM orders o
       LEFT JOIN parents par ON par.id = o.parent_id
       LEFT JOIN students st ON st.id = o.student_id
       WHERE o.id = $1`,
      [req.params.id]
    );
    if (!order[0]) return res.status(404).json({ error: 'Not found' });
    const { rows: items } = await pool.query(
      `SELECT oi.*, p.name as product_name, p.sku FROM order_items oi
       LEFT JOIN products p ON p.id = oi.product_id WHERE oi.order_id = $1`,
      [req.params.id]
    );
    res.json({ ...order[0], items });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  const client = await pool.connect();
  try {
    const { parent_id, student_id, items, notes, created_by, status = 'completed', payment_confirmed = true } = req.body;
    await client.query('BEGIN');

    const { rows: numRows } = await client.query(
      `SELECT COALESCE(MAX(CAST(SUBSTRING(order_number FROM 5) AS INTEGER)), 0) + 1 as next_num FROM orders`
    );
    const orderNumber = `ISS-${String(numRows[0].next_num).padStart(6, '0')}`;

    let total = 0;
    for (const item of items) {
      total += item.quantity * item.unit_price;
    }

    const { rows: [order] } = await client.query(
      `INSERT INTO orders (order_number, parent_id, student_id, status, total_amount, notes, created_by, payment_confirmed)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [orderNumber, parent_id, student_id, status, total, notes, created_by, payment_confirmed]
    );

    for (const item of items) {
      if (!item.size) throw new Error(`Size required for product ${item.product_id}`);
      await client.query(
        `INSERT INTO order_items (order_id, product_id, size, quantity, unit_price, subtotal)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [order.id, item.product_id, item.size, item.quantity, item.unit_price, item.quantity * item.unit_price]
      );

      if (status === 'completed' || status === 'processing') {
        await adjustStock(client, {
          product_id: item.product_id,
          size: item.size,
          quantity: -item.quantity,
          type: 'issuance',
          created_by,
          reference_type: 'issuance',
          reference_id: order.id,
        });
      }
    }

    await client.query('COMMIT');
    res.status(201).json(order);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

router.patch('/:id/status', async (req, res) => {
  const client = await pool.connect();
  try {
    const { status } = req.body;
    const orderId = req.params.id;

    const { rows: [order] } = await client.query('SELECT * FROM orders WHERE id = $1', [orderId]);
    if (!order) return res.status(404).json({ error: 'Not found' });

    const { rows: items } = await client.query(
      'SELECT * FROM order_items WHERE order_id = $1',
      [orderId]
    );

    await client.query('BEGIN');

    if (status === 'completed' && order.status !== 'completed') {
      for (const item of items) {
        await adjustStock(client, {
          product_id: item.product_id,
          size: item.size || 'M',
          quantity: -item.quantity,
          type: 'issuance',
          reference_type: 'issuance',
          reference_id: orderId,
        });
      }
    }

    if (status === 'cancelled' && order.status === 'completed') {
      for (const item of items) {
        await adjustStock(client, {
          product_id: item.product_id,
          size: item.size || 'M',
          quantity: item.quantity,
          type: 'return',
          reference_type: 'order_cancel',
          reference_id: orderId,
        });
      }
    }

    const { rows: [updated] } = await client.query(
      `UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [status, orderId]
    );

    await client.query('COMMIT');
    res.json(updated);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

export default router;
