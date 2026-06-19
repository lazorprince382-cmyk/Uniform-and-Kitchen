import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../db/pool.js';
import { authenticate, attachUser } from '../middleware/auth.js';

const router = Router();

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const { rows } = await pool.query(
      `SELECT u.*, r.name as role_name, r.permissions
       FROM users u LEFT JOIN roles r ON u.role_id = r.id
       WHERE u.email = $1 AND u.is_active = true`,
      [email]
    );
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role_name: user.role_name,
        avatar_url: user.avatar_url,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/me', authenticate, attachUser, (req, res) => {
  const u = req.userDetails;
  if (!u) return res.status(404).json({ error: 'User not found' });
  res.json({
    id: u.id,
    email: u.email,
    full_name: u.full_name,
    role_name: u.role_name,
    avatar_url: u.avatar_url,
    permissions: Array.isArray(u.permissions)
      ? u.permissions
      : typeof u.permissions === 'string'
        ? (() => {
            try {
              const p = JSON.parse(u.permissions);
              return Array.isArray(p) ? p : [];
            } catch {
              return [];
            }
          })()
        : [],
  });
});

router.patch('/profile', authenticate, attachUser, async (req, res) => {
  try {
    const u = req.userDetails;
    if (!u) return res.status(404).json({ error: 'User not found' });

    const { full_name, avatar_url } = req.body;
    const updates = [];
    const params = [];
    let i = 1;

    if (full_name !== undefined) {
      const name = String(full_name).trim();
      if (name.length < 2) return res.status(400).json({ error: 'Name must be at least 2 characters' });
      updates.push(`full_name = $${i++}`);
      params.push(name);
    }

    if (avatar_url !== undefined) {
      if (avatar_url === null || avatar_url === '') {
        updates.push(`avatar_url = NULL`);
      } else if (typeof avatar_url === 'string') {
        if (avatar_url.length > 600_000) {
          return res.status(400).json({ error: 'Image is too large. Use a photo under 400 KB.' });
        }
        updates.push(`avatar_url = $${i++}`);
        params.push(avatar_url);
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Nothing to update' });
    }

    updates.push('updated_at = NOW()');
    params.push(u.id);

    const { rows } = await pool.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${i}
       RETURNING id, email, full_name, avatar_url`,
      params
    );

    const row = rows[0];
    res.json({
      id: row.id,
      email: row.email,
      full_name: row.full_name,
      role_name: u.role_name,
      avatar_url: row.avatar_url,
      permissions: Array.isArray(u.permissions)
      ? u.permissions
      : typeof u.permissions === 'string'
        ? (() => {
            try {
              const p = JSON.parse(u.permissions);
              return Array.isArray(p) ? p : [];
            } catch {
              return [];
            }
          })()
        : [],
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/password', authenticate, attachUser, async (req, res) => {
  try {
    const u = req.userDetails;
    if (!u) return res.status(404).json({ error: 'User not found' });

    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) {
      return res.status(400).json({ error: 'Current and new password are required' });
    }
    if (String(new_password).length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }
    if (!(await bcrypt.compare(current_password, u.password_hash))) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const hash = await bcrypt.hash(new_password, 10);
    await pool.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [
      hash,
      u.id,
    ]);
    res.json({ success: true, message: 'Password updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
