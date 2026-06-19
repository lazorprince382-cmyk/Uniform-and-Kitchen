import pool from './pool.js';
import { CATEGORIES, PRODUCTS } from '../config/uniformCatalog.js';

async function updateCatalog() {
  try {
    for (const cat of CATEGORIES) {
      await pool.query(
        `INSERT INTO categories (name, description, color_code) VALUES ($1, $2, $3)
         ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description, color_code = EXCLUDED.color_code`,
        [cat.name, cat.description, cat.color_code]
      );
    }

    const { rows: cats } = await pool.query('SELECT id, name FROM categories');

    for (const p of PRODUCTS) {
      const cat = cats.find((c) => c.name === p.category);
      await pool.query(
        `INSERT INTO products (name, sku, category_id, unit_price, current_stock, min_stock_level, image_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (sku) DO UPDATE SET
           name = EXCLUDED.name,
           category_id = EXCLUDED.category_id,
           unit_price = EXCLUDED.unit_price,
           min_stock_level = EXCLUDED.min_stock_level,
           image_url = EXCLUDED.image_url`,
        [
          p.name,
          p.sku,
          cat?.id,
          p.price,
          0,
          p.min,
          p.image || `https://api.dicebear.com/7.x/shapes/svg?seed=${p.sku}`,
        ]
      );
    }

    await pool.query(`
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_confirmed BOOLEAN DEFAULT true
    `);

    console.log('Uniform catalog updated:', PRODUCTS.length, 'products');
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

updateCatalog();
