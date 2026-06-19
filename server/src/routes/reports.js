import { Router } from 'express';
import pool from '../db/pool.js';

const router = Router();

function toSafeSheetRows(headers, rows) {
  const esc = (v) => {
    const s = String(v ?? '');
    return s.replace(/\t/g, ' ').replace(/\r?\n/g, ' ');
  };
  return [
    headers.join('\t'),
    ...rows.map((r) => headers.map((h) => esc(r[h])).join('\t')),
  ].join('\n');
}

router.get('/stock', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT p.*, c.name as category_name,
        CASE WHEN p.current_stock <= p.min_stock_level THEN true ELSE false END as is_low_stock
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      ORDER BY p.current_stock ASC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/sales', async (req, res) => {
  try {
    const days = Math.min(365, Math.max(7, parseInt(req.query.days, 10) || 90));

    const { rows: summary } = await pool.query(
      `
      SELECT
        COUNT(DISTINCT o.id)::int as total_issuances,
        COUNT(DISTINCT o.student_id)::int as students_served,
        COALESCE(SUM(oi.quantity), 0)::int as total_items
      FROM orders o
      LEFT JOIN order_items oi ON oi.order_id = o.id
      WHERE o.status = 'completed'
        AND o.created_at >= NOW() - ($1::integer * INTERVAL '1 day')
    `,
      [days]
    );

    const { rows: lines } = await pool.query(
      `
      SELECT
        oi.id as item_id,
        o.id as order_id,
        oi.product_id,
        o.order_number,
        o.created_at,
        st.full_name as student_name,
        st.class_grade,
        st.section,
        par.full_name as parent_name,
        par.phone as parent_phone,
        p.name as product_name,
        p.sku,
        c.name as category_name,
        oi.size,
        oi.quantity
      FROM orders o
      INNER JOIN order_items oi ON oi.order_id = o.id
      LEFT JOIN students st ON st.id = o.student_id
      LEFT JOIN parents par ON par.id = o.parent_id
      LEFT JOIN products p ON p.id = oi.product_id
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE o.status = 'completed'
        AND o.created_at >= NOW() - ($1::integer * INTERVAL '1 day')
      ORDER BY o.created_at DESC, o.order_number, p.name, oi.size
    `,
      [days]
    );

    res.json({
      summary: { ...summary[0], days },
      lines,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/low-stock', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT p.*, c.name as category_name,
        (p.min_stock_level - p.current_stock) as units_needed
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.current_stock <= p.min_stock_level
      ORDER BY p.current_stock ASC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/export/:type', async (req, res) => {
  try {
    const { type } = req.params;
    if (type === 'stock') {
      const { rows } = await pool.query(`
        SELECT p.name, c.name as category_name, p.current_stock, p.min_stock_level
        FROM products p
        LEFT JOIN categories c ON c.id = p.category_id
        ORDER BY p.name
      `);
      const headers = ['name', 'category_name', 'current_stock', 'min_stock_level'];
      const content = toSafeSheetRows(headers, rows);
      res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="stock-report-${Date.now()}.xls"`);
      return res.send(content);
    }

    if (type === 'issuances') {
      const days = Math.min(365, Math.max(7, parseInt(req.query.days, 10) || 90));
      const { rows } = await pool.query(
        `
        SELECT
          o.order_number,
          o.created_at,
          st.full_name as student_name,
          st.class_grade,
          st.section,
          par.full_name as parent_name,
          p.name as product_name,
          c.name as category_name,
          oi.size,
          oi.quantity
        FROM orders o
        INNER JOIN order_items oi ON oi.order_id = o.id
        LEFT JOIN students st ON st.id = o.student_id
        LEFT JOIN parents par ON par.id = o.parent_id
        LEFT JOIN products p ON p.id = oi.product_id
        LEFT JOIN categories c ON c.id = p.category_id
        WHERE o.status = 'completed'
          AND o.created_at >= NOW() - ($1::integer * INTERVAL '1 day')
        ORDER BY o.created_at DESC, o.order_number, p.name, oi.size
      `,
        [days]
      );
      const headers = [
        'order_number',
        'created_at',
        'student_name',
        'class_grade',
        'section',
        'parent_name',
        'product_name',
        'category_name',
        'size',
        'quantity',
      ];
      const content = toSafeSheetRows(headers, rows);
      res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="issuances-report-${Date.now()}.xls"`);
      return res.send(content);
    }

    if (type === 'low-stock') {
      const { rows } = await pool.query(`
        SELECT p.name, c.name as category_name, p.current_stock, p.min_stock_level,
               (p.min_stock_level - p.current_stock) as units_needed
        FROM products p
        LEFT JOIN categories c ON c.id = p.category_id
        WHERE p.current_stock <= p.min_stock_level
        ORDER BY p.current_stock ASC
      `);
      const headers = ['name', 'category_name', 'current_stock', 'min_stock_level', 'units_needed'];
      const content = toSafeSheetRows(headers, rows);
      res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="low-stock-report-${Date.now()}.xls"`);
      return res.send(content);
    }

    return res.status(400).json({ error: 'Unknown report type' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
