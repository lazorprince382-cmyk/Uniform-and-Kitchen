import { Router } from 'express';
import pool from '../db/pool.js';

const router = Router();

router.get('/stats', async (req, res) => {
  try {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [items, stock, lowStock, issuances, collections, overview, lowAlerts, recentIssuances, byCategory, movement, students, parents] =
      await Promise.all([
        pool.query('SELECT COUNT(*)::int as count FROM products'),
        pool.query('SELECT COALESCE(SUM(current_stock), 0)::int as total FROM products'),
        pool.query(
          'SELECT COUNT(*)::int as count FROM products WHERE current_stock <= min_stock_level'
        ),
        pool.query(
          `SELECT COUNT(*)::int as count FROM orders WHERE created_at >= $1`,
          [monthStart]
        ),
        pool.query(
          `SELECT COALESCE(SUM(total_amount), 0)::numeric as total FROM orders
           WHERE status = 'completed' AND created_at >= $1`,
          [monthStart]
        ),
        pool.query(`
          SELECT c.id, c.name, c.color_code,
            COUNT(p.id)::int as item_count,
            COALESCE(SUM(p.current_stock), 0)::int as total_units
          FROM categories c
          LEFT JOIN products p ON p.category_id = c.id
          GROUP BY c.id, c.name, c.color_code
          ORDER BY total_units DESC
        `),
        pool.query(`
          SELECT p.id, p.name, p.sku, p.image_url, p.min_stock_level,
            COALESCE(SUM(inv.quantity), 0)::int as current_stock,
            inv.size
          FROM products p
          LEFT JOIN inventory_stock inv ON inv.product_id = p.id
          GROUP BY p.id, p.name, p.sku, p.image_url, p.min_stock_level, inv.size
          HAVING COALESCE(SUM(inv.quantity), 0) <= p.min_stock_level AND COALESCE(SUM(inv.quantity), 0) > 0
          ORDER BY current_stock ASC
          LIMIT 10
        `),
        pool.query(`
          SELECT o.id, o.order_number, o.status, o.created_at, o.total_amount,
            par.full_name as parent_name,
            st.full_name as student_name,
            st.class_grade
          FROM orders o
          LEFT JOIN parents par ON par.id = o.parent_id
          LEFT JOIN students st ON st.id = o.student_id
          ORDER BY o.created_at DESC
          LIMIT 8
        `),
        pool.query(`
          SELECT c.id as category_id, c.name as category_name, c.color_code,
            p.id, p.name, p.current_stock, p.image_url
          FROM categories c
          LEFT JOIN products p ON p.category_id = c.id
          ORDER BY c.name, p.name
        `),
        pool.query(`
          SELECT
            COALESCE(SUM(CASE WHEN quantity > 0 THEN quantity ELSE 0 END), 0)::int as stock_in,
            COALESCE(SUM(CASE WHEN quantity < 0 THEN ABS(quantity) ELSE 0 END), 0)::int as stock_out
          FROM stock_transactions
          WHERE created_at >= $1
        `, [monthStart]),
        pool.query('SELECT COUNT(*)::int as count FROM students'),
        pool.query('SELECT COUNT(*)::int as count FROM parents'),
      ]);

    const totalUnits = overview.rows.reduce((s, r) => s + r.total_units, 0);
    const categoryOverview = overview.rows.map((r) => ({
      ...r,
      percentage: totalUnits ? Math.round((r.total_units / totalUnits) * 1000) / 10 : 0,
    }));

    const grouped = {};
    for (const row of byCategory.rows) {
      if (!grouped[row.category_name]) {
        grouped[row.category_name] = {
          category_id: row.category_id,
          category_name: row.category_name,
          color_code: row.color_code,
          products: [],
        };
      }
      if (row.id) {
        grouped[row.category_name].products.push({
          id: row.id,
          name: row.name,
          current_stock: row.current_stock,
          image_url: row.image_url,
        });
      }
    }

    const mov = movement.rows[0];
    const stockIn = mov?.stock_in || 0;
    const stockOut = mov?.stock_out || 0;

    res.json({
      metrics: {
        totalItems: items.rows[0].count,
        totalStock: stock.rows[0].total,
        lowStockItems: lowStock.rows[0].count,
        totalIssuances: issuances.rows[0].count,
        totalCollections: parseFloat(collections.rows[0].total),
        enrolledStudents: students.rows[0].count,
        registeredParents: parents.rows[0].count,
      },
      categoryOverview,
      lowStockAlerts: lowAlerts.rows,
      recentIssuances: recentIssuances.rows,
      inventoryByCategory: Object.values(grouped),
      stockMovement: {
        stockIn,
        stockOut,
        netMovement: stockIn - stockOut,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/search', async (req, res) => {
  try {
    const q = `%${req.query.q || ''}%`;
    const [products, orders, parents, students] = await Promise.all([
      pool.query(
        `SELECT id, name, 'product' as type FROM products
         WHERE name ILIKE $1 LIMIT 5`,
        [q]
      ),
      pool.query(
        `SELECT id, order_number as name, 'issuance' as type FROM orders
         WHERE order_number ILIKE $1 LIMIT 5`,
        [q]
      ),
      pool.query(
        `SELECT id, full_name as name, 'parent' as type FROM parents
         WHERE full_name ILIKE $1 OR phone ILIKE $1 LIMIT 5`,
        [q]
      ),
      pool.query(
        `SELECT s.id, s.full_name as name, 'student' as type FROM students s
         WHERE s.full_name ILIKE $1 OR s.admission_no ILIKE $1 LIMIT 5`,
        [q]
      ),
    ]);
    res.json([
      ...products.rows,
      ...orders.rows,
      ...parents.rows,
      ...students.rows,
    ]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/notifications', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });
    const { rows } = await pool.query(
      `SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20`,
      [userId]
    );
    const { rows: unread } = await pool.query(
      `SELECT COUNT(*)::int as count FROM notifications WHERE user_id = $1 AND is_read = false`,
      [userId]
    );
    res.json({ notifications: rows, unreadCount: unread[0].count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
