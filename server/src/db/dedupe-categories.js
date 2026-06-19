import pool from './pool.js';

async function dedupe() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: cats } = await client.query('SELECT id, name FROM categories ORDER BY id');
    const keepByName = {};

    for (const cat of cats) {
      if (!keepByName[cat.name]) {
        keepByName[cat.name] = cat.id;
      } else {
        const keepId = keepByName[cat.name];
        await client.query('UPDATE products SET category_id = $1 WHERE category_id = $2', [keepId, cat.id]);
        await client.query('DELETE FROM categories WHERE id = $1', [cat.id]);
      }
    }

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS categories_name_unique ON categories (name)
    `);

    await client.query('COMMIT');
    const { rows: after } = await pool.query('SELECT id, name FROM categories ORDER BY name');
    console.log('Categories after cleanup:', after);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

dedupe().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
