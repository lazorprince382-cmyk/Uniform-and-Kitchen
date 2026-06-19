import pool from './pool.js';
import { PRODUCTS } from '../config/uniformCatalog.js';

const VALID_SKUS = PRODUCTS.map((p) => p.sku);

async function reset() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: orphans } = await client.query(
      `SELECT id FROM products WHERE sku NOT IN (${VALID_SKUS.map((_, i) => `$${i + 1}`).join(',')})`,
      VALID_SKUS
    );
    const orphanIds = orphans.map((o) => o.id);

    if (orphanIds.length) {
      await client.query(`DELETE FROM order_items WHERE product_id = ANY($1)`, [orphanIds]);
      await client.query(`DELETE FROM return_items WHERE product_id = ANY($1)`, [orphanIds]);
      await client.query(`DELETE FROM stock_transactions WHERE product_id = ANY($1)`, [orphanIds]);
      await client.query(`DELETE FROM inventory_stock WHERE product_id = ANY($1)`, [orphanIds]);
      await client.query(`DELETE FROM products WHERE id = ANY($1)`, [orphanIds]);
      console.log(`Removed ${orphanIds.length} products not in catalog.`);
    }

    await client.query('DELETE FROM inventory_stock');
    await client.query('DELETE FROM stock_transactions');
    await client.query('UPDATE products SET current_stock = 0');

    await client.query('COMMIT');
    console.log('Inventory cleared. Only catalog products remain. Add stock via Add Stock page.');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

reset().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
