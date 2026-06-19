import pool from './pool.js';
import { PRODUCT_GENDER_BY_SKU } from '../config/uniformCatalog.js';

async function migrate() {
  try {
    await pool.query(`
      ALTER TABLE students ADD COLUMN IF NOT EXISTS gender VARCHAR(10)
    `);
    await pool.query(`
      ALTER TABLE products ADD COLUMN IF NOT EXISTS gender VARCHAR(10)
    `);

    for (const [sku, gender] of Object.entries(PRODUCT_GENDER_BY_SKU)) {
      await pool.query(`UPDATE products SET gender = $1 WHERE sku = $2`, [gender, sku]);
    }

    console.log('Gender columns added; product gender labels updated.');
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
