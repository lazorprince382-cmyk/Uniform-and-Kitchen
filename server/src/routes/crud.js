import { Router } from 'express';
import pool from '../db/pool.js';
import { setProductSizes } from '../services/inventory.js';

/** Internal code only — not shown in the UI */
function makeInternalSku(name) {
  const base =
    String(name || 'ITEM')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 28) || 'ITEM';
  return `${base}-${Date.now().toString(36).toUpperCase()}`;
}

function createCrudRouter(table, fields, options = {}) {
  const router = Router();
  const selectFields = options.select || '*';

  router.get('/', async (req, res) => {
    try {
      let query = `SELECT ${selectFields} FROM ${table}`;
      const params = [];
      if (options.join) {
        query = options.join;
      }
      if (req.query.category_id && table === 'products') {
        query += ` WHERE category_id = $1`;
        params.push(req.query.category_id);
      }
      query += ` ORDER BY ${options.orderBy || 'id DESC'}`;
      const { rows } = await pool.query(query, params);
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/:id', async (req, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT ${selectFields} FROM ${table} WHERE id = $1`,
        [req.params.id]
      );
      if (!rows[0]) return res.status(404).json({ error: 'Not found' });
      res.json(rows[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/', async (req, res) => {
    try {
      const keys = fields.filter((f) => req.body[f] !== undefined);
      const values = keys.map((k) => req.body[k]);
      const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
      const { rows } = await pool.query(
        `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders}) RETURNING *`,
        values
      );
      res.status(201).json(rows[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/:id', async (req, res) => {
    try {
      const keys = fields.filter((f) => req.body[f] !== undefined);
      const values = keys.map((k) => req.body[k]);
      const setClause = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
      values.push(req.params.id);
      const { rows } = await pool.query(
        `UPDATE ${table} SET ${setClause} WHERE id = $${values.length} RETURNING *`,
        values
      );
      if (!rows[0]) return res.status(404).json({ error: 'Not found' });
      res.json(rows[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/:id', async (req, res) => {
    try {
      const { rowCount } = await pool.query(`DELETE FROM ${table} WHERE id = $1`, [
        req.params.id,
      ]);
      if (!rowCount) return res.status(404).json({ error: 'Not found' });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}

const categoriesRouter = Router();

categoriesRouter.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT DISTINCT ON (name) id, name, description, color_code, created_at
       FROM categories ORDER BY name, id ASC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

categoriesRouter.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM categories WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

categoriesRouter.post('/', async (req, res) => {
  try {
    const { name, description, color_code } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO categories (name, description, color_code) VALUES ($1,$2,$3)
       ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description, color_code = EXCLUDED.color_code
       RETURNING *`,
      [name, description, color_code]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

categoriesRouter.put('/:id', async (req, res) => {
  try {
    const { name, description, color_code } = req.body;
    const { rows } = await pool.query(
      `UPDATE categories SET name=$1, description=$2, color_code=$3 WHERE id=$4 RETURNING *`,
      [name, description, color_code, req.params.id]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

categoriesRouter.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM categories WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export { categoriesRouter };

export const suppliersRouter = createCrudRouter('suppliers', [
  'name',
  'contact_person',
  'email',
  'phone',
  'address',
]);

export const customersRouter = createCrudRouter('customers', [
  'name',
  'type',
  'email',
  'phone',
  'address',
]);

export const productsRouter = Router();

productsRouter.get('/', async (req, res) => {
  try {
    let query = `
      SELECT p.*, c.name as category_name, p.gender
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE 1=1
    `;
    const params = [];
    if (req.query.category_id) {
      params.push(req.query.category_id);
      query += ` AND p.category_id = $${params.length}`;
    }
    if (req.query.low_stock === 'true') {
      query += ` AND p.current_stock <= p.min_stock_level`;
    }
    query += ' ORDER BY p.name';
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Per-size stock for one product only (used by Edit Product). */
productsRouter.get('/:id/inventory-sizes', async (req, res) => {
  try {
    const productId = parseInt(req.params.id, 10);
    if (!Number.isFinite(productId)) {
      return res.status(400).json({ error: 'Invalid product id' });
    }
    const { rows: products } = await pool.query(
      `SELECT id, name, current_stock FROM products WHERE id = $1`,
      [productId]
    );
    if (!products[0]) return res.status(404).json({ error: 'Not found' });

    let { rows: sizeRows } = await pool.query(
      `SELECT size, quantity FROM inventory_stock
       WHERE product_id = $1
       ORDER BY size`,
      [productId]
    );

    const withoutOneSize = sizeRows.filter((r) => r.size !== 'One Size');
    if (withoutOneSize.length > 0) sizeRows = withoutOneSize;

    res.json({
      product_id: productId,
      product_name: products[0].name,
      sizes: sizeRows,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

productsRouter.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT p.*, c.name as category_name FROM products p
       LEFT JOIN categories c ON c.id = p.category_id WHERE p.id = $1`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    const product = rows[0];
    let { rows: sizeRows } = await pool.query(
      `SELECT size, quantity FROM inventory_stock
       WHERE product_id = $1
       ORDER BY size`,
      [req.params.id]
    );

    // Prefer real per-size rows over a lone legacy "One Size" bucket
    const withoutOneSize = sizeRows.filter((r) => r.size !== 'One Size');
    if (withoutOneSize.length > 0) {
      sizeRows = withoutOneSize;
    }

    // Legacy: total on product only — return for display, do not write to DB on read
    if (sizeRows.length === 0 && product.current_stock > 0) {
      sizeRows = [{ size: '', quantity: product.current_stock }];
    }

    res.json({ ...product, sizes: sizeRows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

productsRouter.post('/', async (req, res) => {
  const client = await pool.connect();
  try {
    const { name, category_id, description, image_url, unit_price, min_stock_level, sizes } = req.body;
    const sku = makeInternalSku(name);
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO products (name, sku, category_id, description, image_url, unit_price, current_stock, min_stock_level)
       VALUES ($1,$2,$3,$4,$5,$6,0,$7) RETURNING *`,
      [name, sku, category_id, description, image_url, unit_price || 0, min_stock_level || 20]
    );
    if (Array.isArray(sizes) && sizes.length > 0) {
      await setProductSizes(client, rows[0].id, sizes);
    }
    const { rows: refreshed } = await client.query(`SELECT * FROM products WHERE id = $1`, [rows[0].id]);
    await client.query('COMMIT');
    res.status(201).json(refreshed[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

productsRouter.put('/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    const { sizes, ...body } = req.body;
    const fields = ['name', 'category_id', 'description', 'image_url', 'unit_price', 'min_stock_level'];
    const keys = fields.filter((f) => body[f] !== undefined);
    const values = keys.map((k) => body[k]);
    await client.query('BEGIN');
    let product;
    if (keys.length > 0) {
      const setClause = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
      values.push(req.params.id);
      const { rows } = await client.query(
        `UPDATE products SET ${setClause}, updated_at = NOW() WHERE id = $${values.length} RETURNING *`,
        values
      );
      product = rows[0];
    } else {
      const { rows } = await client.query(`SELECT * FROM products WHERE id = $1`, [req.params.id]);
      if (!rows[0]) return res.status(404).json({ error: 'Not found' });
      product = rows[0];
    }
    if (Array.isArray(sizes)) {
      const withSizes = sizes.filter((s) => String(s.size || '').trim());
      if (withSizes.length > 0) {
        await setProductSizes(client, product.id, withSizes);
        const { rows: refreshed } = await client.query(`SELECT * FROM products WHERE id = $1`, [product.id]);
        product = refreshed[0];
      }
      // Empty sizes array: update product fields only — do not wipe inventory
    }
    await client.query('COMMIT');
    res.json(product);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

productsRouter.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM products WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
