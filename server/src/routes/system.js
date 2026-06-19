import { Router } from 'express';
import bcrypt from 'bcryptjs';
import pool from '../db/pool.js';

const router = Router();

router.get('/users', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT u.id, u.email, u.full_name, u.is_active, u.created_at, r.name as role_name
      FROM users u LEFT JOIN roles r ON r.id = u.role_id ORDER BY u.id
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/users', async (req, res) => {
  try {
    const { email, password, full_name, role_id } = req.body;
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      `INSERT INTO users (email, password_hash, full_name, role_id)
       VALUES ($1, $2, $3, $4) RETURNING id, email, full_name, role_id`,
      [email, hash, full_name, role_id]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/roles', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM roles ORDER BY id');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/roles/:id', async (req, res) => {
  try {
    const { name, description, permissions } = req.body;
    const { rows } = await pool.query(
      `UPDATE roles SET name = $1, description = $2, permissions = $3 WHERE id = $4 RETURNING *`,
      [name, description, JSON.stringify(permissions), req.params.id]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/settings', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM settings');
    const settings = {};
    for (const row of rows) settings[row.key] = row.value;
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/settings', async (req, res) => {
  try {
    for (const [key, value] of Object.entries(req.body)) {
      await pool.query(
        `INSERT INTO settings (key, value) VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
        [key, JSON.stringify(value)]
      );
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
