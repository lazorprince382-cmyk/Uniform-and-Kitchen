import pool from './pool.js';

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: hasCustomers } = await client.query(
      `SELECT 1 FROM information_schema.tables WHERE table_name = 'customers'`
    );
    const { rows: hasParents } = await client.query(
      `SELECT 1 FROM information_schema.tables WHERE table_name = 'parents'`
    );

    if (hasCustomers.length && !hasParents.length) {
      await client.query(`ALTER TABLE customers RENAME TO parents`);
      await client.query(`ALTER TABLE parents RENAME COLUMN name TO full_name`);
      await client.query(`ALTER TABLE parents DROP COLUMN IF EXISTS type`);
      console.log('Renamed customers → parents');
    }

    await client.query(`
      CREATE TABLE IF NOT EXISTS students (
        id SERIAL PRIMARY KEY,
        parent_id INTEGER REFERENCES parents(id) ON DELETE CASCADE,
        full_name VARCHAR(200) NOT NULL,
        admission_no VARCHAR(50),
        class_grade VARCHAR(50) NOT NULL DEFAULT 'N/A',
        section VARCHAR(20),
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    const { rows: orderCols } = await client.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'orders'`
    );
    const colNames = orderCols.map((c) => c.column_name);

    if (!colNames.includes('parent_id')) {
      await client.query(`ALTER TABLE orders ADD COLUMN parent_id INTEGER REFERENCES parents(id)`);
    }
    if (!colNames.includes('student_id')) {
      await client.query(`ALTER TABLE orders ADD COLUMN student_id INTEGER REFERENCES students(id)`);
    }
    if (colNames.includes('customer_id')) {
      await client.query(`UPDATE orders SET parent_id = customer_id WHERE parent_id IS NULL`);
      await client.query(`ALTER TABLE orders DROP COLUMN customer_id`);
    }

    const { rows: retCols } = await client.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'returns'`
    );
    const retNames = retCols.map((c) => c.column_name);
    if (!retNames.includes('parent_id')) {
      await client.query(`ALTER TABLE returns ADD COLUMN parent_id INTEGER REFERENCES parents(id)`);
    }
    if (!retNames.includes('student_id')) {
      await client.query(`ALTER TABLE returns ADD COLUMN student_id INTEGER REFERENCES students(id)`);
    }
    if (retNames.includes('customer_id')) {
      await client.query(`UPDATE returns SET parent_id = customer_id WHERE parent_id IS NULL`);
      await client.query(`ALTER TABLE returns DROP COLUMN customer_id`);
    }

    await client.query(`
      ALTER TABLE stock_transactions DROP CONSTRAINT IF EXISTS stock_transactions_type_check
    `);
    await client.query(`
      ALTER TABLE stock_transactions ADD CONSTRAINT stock_transactions_type_check
      CHECK (type IN ('stock_in', 'stock_out', 'return', 'adjustment', 'issuance', 'order'))
    `);

    await client.query('COMMIT');
    console.log('School migration completed.');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((e) => {
  console.error('Migration failed:', e.message);
  process.exit(1);
});
