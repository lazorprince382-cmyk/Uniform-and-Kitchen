import pool from './pool.js';

async function run() {
  await pool.query(
    `UPDATE products SET name = 'Beige Skirts', sku = 'US-BSK' WHERE name = 'White Skirts' OR sku = 'US-WSK'`
  );
  console.log('Renamed White Skirts → Beige Skirts');
  await pool.end();
}

run();
