import { Router } from 'express';
import pool from '../db/pool.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT r.*, par.full_name as parent_name, st.full_name as student_name,
        o.order_number
      FROM returns r
      LEFT JOIN parents par ON par.id = r.parent_id
      LEFT JOIN students st ON st.id = r.student_id
      LEFT JOIN orders o ON o.id = r.order_id
      ORDER BY r.created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  const client = await pool.connect();
  try {
    const { order_id, parent_id, student_id, items, reason } = req.body;
    await client.query('BEGIN');

    const { rows: numRows } = await client.query(
      `SELECT COALESCE(MAX(CAST(SUBSTRING(return_number FROM 5) AS INTEGER)), 0) + 1 as next_num FROM returns`
    );
    const returnNumber = `RET-${String(numRows[0].next_num).padStart(6, '0')}`;

    let total = 0;
    for (const item of items) total += item.quantity * item.unit_price;

    const { rows: [ret] } = await client.query(
      `INSERT INTO returns (return_number, order_id, parent_id, student_id, reason, total_amount, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'approved') RETURNING *`,
      [returnNumber, order_id, parent_id, student_id, reason, total]
    );

    for (const item of items) {
      await client.query(
        `INSERT INTO return_items (return_id, product_id, quantity, unit_price)
         VALUES ($1, $2, $3, $4)`,
        [ret.id, item.product_id, item.quantity, item.unit_price]
      );
      await client.query(
        'UPDATE products SET current_stock = current_stock + $1 WHERE id = $2',
        [item.quantity, item.product_id]
      );
      await client.query(
        `INSERT INTO stock_transactions (product_id, quantity, type, reference_type, reference_id)
         VALUES ($1, $2, 'return', 'return', $3)`,
        [item.product_id, item.quantity, ret.id]
      );
    }

    await client.query('COMMIT');
    res.status(201).json(ret);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

export default router;
