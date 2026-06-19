import pool from './pool.js';

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      CREATE TABLE IF NOT EXISTS inventory_stock (
        id SERIAL PRIMARY KEY,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        size VARCHAR(20) NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(product_id, size)
      )
    `);

    await client.query(`
      ALTER TABLE stock_transactions ADD COLUMN IF NOT EXISTS size VARCHAR(20)
    `);
    await client.query(`
      ALTER TABLE order_items ADD COLUMN IF NOT EXISTS size VARCHAR(20)
    `);

    await client.query('COMMIT');
    console.log('Inventory size migration complete.');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
