/**
 * Optional: demo chef accounts (idempotent). Run: node scripts/seed-sample-users.js
 */
require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

function poolConfig() {
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

const samples = [
  {
    username: 'chef_full',
    password: 'ChefFull1!',
    display_name: 'Chef (full kitchen)',
    role: 'chef',
    full_dashboard: true
  },
  {
    username: 'chef_ops',
    password: 'ChefOps1!',
    display_name: 'Chef (operational)',
    role: 'chef',
    full_dashboard: false
  }
];

async function main() {
  const pool = new Pool(poolConfig());
  try {
    for (const s of samples) {
      const hash = bcrypt.hashSync(s.password, 10);
      const r = await pool.query(
        `INSERT INTO users (username, password_hash, display_name, role, full_dashboard, active)
         VALUES ($1, $2, $3, $4, $5, true)
         ON CONFLICT (username) DO UPDATE SET
           password_hash = EXCLUDED.password_hash,
           display_name = EXCLUDED.display_name,
           role = EXCLUDED.role,
           full_dashboard = EXCLUDED.full_dashboard,
           active = true`,
        [s.username, hash, s.display_name, s.role, s.full_dashboard]
      );
      console.log('Upserted:', s.username, '(rows:', r.rowCount, ')');
    }
    console.log('\nSample logins:');
    for (const s of samples) {
      console.log(`  ${s.username} / ${s.password} — ${s.full_dashboard ? 'full kitchen UI' : 'operational only'}`);
    }
  } finally {
    await pool.end();
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
