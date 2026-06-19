require('dotenv').config();
const { Pool, Client } = require('pg');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

function getTargetDatabaseName() {
  if (process.env.DATABASE_URL) {
    try {
      const u = new URL(process.env.DATABASE_URL);
      const name = u.pathname.replace(/^\//, '');
      return name || 'kitchen_db';
    } catch {
      return 'kitchen_db';
    }
  }
  return process.env.PG_DATABASE || 'kitchen_db';
}

function getAdminConnection() {
  if (process.env.DATABASE_URL) {
    const u = new URL(process.env.DATABASE_URL);
    u.pathname = '/postgres';
    return { connectionString: u.toString() };
  }
  return {
    host: process.env.PG_HOST || 'localhost',
    port: parseInt(process.env.PG_PORT, 10) || 5432,
    user: process.env.PG_USER || 'postgres',
    password: process.env.PG_PASSWORD || '',
    database: 'postgres'
  };
}

function getAppPoolConfig() {
  if (process.env.DATABASE_URL) {
    return { connectionString: process.env.DATABASE_URL };
  }
  return {
    host: process.env.PG_HOST || 'localhost',
    port: parseInt(process.env.PG_PORT, 10) || 5432,
    user: process.env.PG_USER || 'postgres',
    password: process.env.PG_PASSWORD || '',
    database: process.env.PG_DATABASE || 'kitchen_db'
  };
}

async function ensureDatabase() {
  const dbName = getTargetDatabaseName();
  if (!/^[a-zA-Z0-9_]+$/.test(dbName)) {
    throw new Error('Invalid database name in configuration.');
  }
  const client = new Client(getAdminConnection());
  await client.connect();
  try {
    const { rows } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
    if (rows.length === 0) {
      await client.query(`CREATE DATABASE "${dbName}"`);
      console.log(`Created database "${dbName}".`);
    } else {
      console.log(`Database "${dbName}" already exists.`);
    }
  } finally {
    await client.end();
  }
}

async function init() {
  await ensureDatabase();
  const pool = new Pool(getAppPoolConfig());
  const schemaPath = path.join(__dirname, '..', 'db', 'schema.sql');
  const seedPath = path.join(__dirname, '..', 'db', 'seed.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');
  await pool.query(schema);
  console.log('Database schema initialized.');
  const migPath = path.join(__dirname, '..', 'db', 'migration_v2_menu_budget.sql');
  await pool.query(fs.readFileSync(migPath, 'utf8'));
  console.log('Migration v2 (menu & inventory purchases) applied.');
  const mig3 = path.join(__dirname, '..', 'db', 'migration_v3_school_kitchen.sql');
  await pool.query(fs.readFileSync(mig3, 'utf8'));
  console.log('Migration v3 (school kitchen: allergens, stock audit, lots) applied.');
  const mig4 = path.join(__dirname, '..', 'db', 'migration_v4_auth.sql');
  await pool.query(fs.readFileSync(mig4, 'utf8'));
  console.log('Migration v4 (users & auth) applied.');
  const seed = fs.readFileSync(seedPath, 'utf8');
  await pool.query(seed);
  console.log('Seed data applied.');
  const { rows: uc } = await pool.query('SELECT COUNT(*)::int AS c FROM users');
  if (intVal(uc[0]?.c) === 0) {
    const initialPw = process.env.INITIAL_ADMIN_PASSWORD || 'KitchenAdmin!';
    const hash = bcrypt.hashSync(initialPw, 10);
    await pool.query(
      `INSERT INTO users (username, password_hash, display_name, role, full_dashboard)
       VALUES ($1, $2, $3, 'admin', true)`,
      ['admin', hash, 'School administrator']
    );
    console.log('Default admin user created (username: admin). Set INITIAL_ADMIN_PASSWORD in .env to override default password.');
    console.log('Default password (change after first login): ' + initialPw);
  }
  await pool.end();
}

function intVal(n) {
  const x = Math.round(Number(n));
  return Number.isFinite(x) ? x : 0;
}

init().catch(err => {
  console.error(err);
  process.exit(1);
});
