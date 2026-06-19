import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const url = new URL(process.env.DATABASE_URL);
const dbName = url.pathname.slice(1);
url.pathname = '/postgres';

const client = new pg.Client({ connectionString: url.toString() });

async function createDb() {
  try {
    await client.connect();
    const { rows } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
    if (rows.length === 0) {
      await client.query(`CREATE DATABASE "${dbName}"`);
      console.log(`Database "${dbName}" created.`);
    } else {
      console.log(`Database "${dbName}" already exists.`);
    }
  } catch (err) {
    console.error('Failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

createDb();
