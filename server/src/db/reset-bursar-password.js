import bcrypt from 'bcryptjs';
import pool from './pool.js';

async function reset() {
  try {
    const hash = await bcrypt.hash('admin123', 10);

    const { rows: existing } = await pool.query(
      `SELECT id, email FROM users WHERE email IN ('bursar@toks.com', 'admin@toks.com')`
    );

    if (existing.length === 0) {
      const { rows: role } = await pool.query(`SELECT id FROM roles WHERE name = 'Administrator' LIMIT 1`);
      await pool.query(
        `INSERT INTO users (email, password_hash, full_name, role_id, is_active)
         VALUES ('bursar@toks.com', $1, 'School Bursar', $2, true)`,
        [hash, role[0]?.id || 1]
      );
      console.log('Created bursar@toks.com with password admin123');
    } else {
      await pool.query(
        `UPDATE users SET password_hash = $1, full_name = 'School Bursar', is_active = true
         WHERE email IN ('bursar@toks.com', 'admin@toks.com')`,
        [hash]
      );
      await pool.query(
        `UPDATE users SET email = 'bursar@toks.com' WHERE email = 'admin@toks.com'`
      );
      console.log('Password reset for bursar@toks.com → admin123');
    }

    const ok = await bcrypt.compare('admin123', hash);
    console.log('Password verify test:', ok ? 'OK' : 'FAILED');
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

reset();
