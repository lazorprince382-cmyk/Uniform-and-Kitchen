import jwt from 'jsonwebtoken';
import pool from '../db/pool.js';

export function authenticate(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

export async function attachUser(req, res, next) {
  if (!req.user?.id) return next();
  const { rows } = await pool.query(
    `SELECT u.*, r.name as role_name, r.permissions
     FROM users u LEFT JOIN roles r ON u.role_id = r.id WHERE u.id = $1`,
    [req.user.id]
  );
  req.userDetails = rows[0];
  next();
}

function normalizePermissions(raw) {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === 'object') {
    if (Array.isArray(raw.list)) return raw.list;
    return [];
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function requirePermission(...perms) {
  return (req, res, next) => {
    const permissions = normalizePermissions(req.userDetails?.permissions);
    if (permissions.includes('*') || perms.some((p) => permissions.includes(p))) {
      return next();
    }
    return res.status(403).json({ error: 'Insufficient permissions' });
  };
}
