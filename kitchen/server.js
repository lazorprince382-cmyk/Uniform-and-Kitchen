require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;
// Must match request paths on this process (/api/*). Nginx serves the app at /kitchen/
// but strips that prefix before proxying, so cookie path cannot be /kitchen here.
let COOKIE_PATH = process.env.COOKIE_PATH || '/';
if (COOKIE_PATH === '/kitchen') {
  console.warn(
    '[kitchen] COOKIE_PATH=/kitchen disables express-session for /api routes; using /'
  );
  COOKIE_PATH = '/';
}

const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const SESSION_SECRET =
  process.env.SESSION_SECRET || 'kitchen-dev-secret-change-in-production';
const SESSION_MAX_AGE_MS =
  parseInt(process.env.SESSION_MAX_AGE_MS, 10) || 10 * 60 * 1000;

app.set('trust proxy', 1);

const pool = new Pool(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : {
        host: process.env.PG_HOST || 'localhost',
        port: process.env.PG_PORT || 5432,
        user: process.env.PG_USER || 'postgres',
        password: process.env.PG_PASSWORD || '',
        database: process.env.PG_DATABASE || 'kitchen_db'
      }
);

pool.on('error', err => {
  console.error('[kitchen] database pool error:', err.message || err);
});

app.use(
  cors({
    origin: true,
    credentials: true
  })
);
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'kitchen' });
});

app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400) {
    return res.status(400).json({ error: 'Invalid JSON' });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON' });
  }
  next(err);
});

function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.COOKIE_SECURE === 'true',
    path: COOKIE_PATH,
    maxAge: SESSION_MAX_AGE_MS
  };
}

function clearKitchenCookie(res) {
  res.clearCookie('kitchen.sid', sessionCookieOptions());
}

app.use(
  session({
    name: 'kitchen.sid',
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    unset: 'destroy',
    proxy: true,
    cookie: sessionCookieOptions()
  })
);

function applySessionPatch(req, userRow) {
  const patch = sessionFromUserRow(userRow);
  for (const key of Object.keys(patch)) {
    req.session[key] = patch[key];
  }
}

function writeKitchenSession(req, res, userRow, jsonUser) {
  if (!req.session) {
    return res.status(500).json({
      error: 'Could not start session. Clear site cookies and try again.'
    });
  }
  try {
    applySessionPatch(req, userRow);
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Session error' });
  }
  req.session.save(err => {
    if (err) return res.status(500).json({ error: err.message || 'Session save failed' });
    res.json({ user: jsonUser });
  });
}

function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Not signed in' });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (req.session.role !== 'admin') {
    return res.status(403).json({ error: 'Admin only' });
  }
  next();
}

/** Admin, or chef with "full kitchen" access (can edit recipes, budget, etc.). */
function requireKitchenManager(req, res, next) {
  if (req.session.role === 'admin') return next();
  if (req.session.role === 'chef' && req.session.fullDashboard) return next();
  return res.status(403).json({ error: 'Your account can only use day-to-day kitchen tasks. Ask an admin.' });
}

function sessionFromUserRow(u) {
  const fullDash = u.role === 'admin' ? true : Boolean(u.full_dashboard);
  return {
    userId: u.id,
    username: u.username,
    role: u.role,
    fullDashboard: fullDash
  };
}

app.post('/api/auth/login', async (req, res) => {
  const username = String(req.body.username || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  try {
    const { rows } = await pool.query(
      `SELECT id, username, display_name, password_hash, role, full_dashboard, active
       FROM users WHERE lower(username) = $1`,
      [username]
    );
    const u = rows[0];
    if (!u || !u.active) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    if (!u.password_hash || !bcrypt.compareSync(password, u.password_hash)) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    const fullDash = u.role === 'admin' ? true : Boolean(u.full_dashboard);
    const jsonUser = {
      id: u.id,
      username: u.username,
      display_name: u.display_name,
      role: u.role,
      full_dashboard: fullDash
    };
    writeKitchenSession(req, res, u, jsonUser);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).json({ error: err.message });
    res.clearCookie('kitchen.sid', { path: COOKIE_PATH });
    res.json({ ok: true });
  });
});

app.get('/api/auth/me', async (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.json({ user: null });
  }
  try {
    const { rows } = await pool.query(
      `SELECT id, username, display_name, role, full_dashboard, active FROM users WHERE id = $1`,
      [req.session.userId]
    );
    const u = rows[0];
    if (!u || !u.active) {
      req.session.destroy(() => {});
      return res.json({ user: null });
    }
    const fullDash = u.role === 'admin' ? true : Boolean(u.full_dashboard);
    const jsonUser = {
      id: u.id,
      username: u.username,
      display_name: u.display_name,
      role: u.role,
      full_dashboard: fullDash
    };
    writeKitchenSession(req, res, u, jsonUser);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const api = express.Router();
api.use(requireAuth);

// NOTE: static files are registered after all /api routes so /api/* is never shadowed by public files.

/** Whole UGX and whole-unit quantities (no decimals in calculations). */
function intMoney(v) {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? n : 0;
}
function intQty(v) {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

function normalizeAllergenTags(v) {
  if (!Array.isArray(v)) return [];
  return [...new Set(v.map(x => String(x).trim().toLowerCase()).filter(Boolean))];
}

async function ensureLotsForIngredient(client, ingredientId) {
  const { rows: lc } = await client.query(
    'SELECT COALESCE(SUM(quantity_remaining), 0)::int AS s FROM ingredient_lots WHERE ingredient_id = $1',
    [ingredientId]
  );
  const { rows: ir } = await client.query('SELECT current_stock FROM ingredients WHERE id = $1', [ingredientId]);
  const stock = intQty(ir[0]?.current_stock);
  if (stock <= 0) return;
  const lotSum = intQty(lc[0]?.s);
  if (lotSum === 0) {
    await client.query(
      'INSERT INTO ingredient_lots (ingredient_id, quantity_remaining, expiry_date) VALUES ($1, $2, NULL)',
      [ingredientId, stock]
    );
  }
}

async function deductLotsFifo(client, ingredientId, need) {
  let left = need;
  const { rows: lots } = await client.query(
    `SELECT id, quantity_remaining FROM ingredient_lots WHERE ingredient_id = $1 AND quantity_remaining > 0 ORDER BY expiry_date NULLS LAST, id ASC`,
    [ingredientId]
  );
  for (const lot of lots) {
    if (left <= 0) break;
    const take = Math.min(intQty(lot.quantity_remaining), left);
    await client.query('UPDATE ingredient_lots SET quantity_remaining = quantity_remaining - $1 WHERE id = $2', [take, lot.id]);
    left -= take;
  }
}

// ----- Units -----
api.get('/units', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT id, name FROM units ORDER BY name');
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ----- Ingredients -----
api.get('/ingredients', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT i.*, u.name AS unit_name
      FROM ingredients i
      JOIN units u ON i.unit_id = u.id
      ORDER BY i.name
    `);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

api.post('/ingredients', requireKitchenManager, async (req, res) => {
  const { name, unit_id, cost_per_unit, min_stock, max_stock, current_stock, allergen_tags } = req.body;
  const tagsJson = JSON.stringify(normalizeAllergenTags(allergen_tags));
  const startStock = intQty(current_stock ?? 0);
  try {
    const { rows } = await pool.query(
      `INSERT INTO ingredients (name, unit_id, cost_per_unit, min_stock, max_stock, current_stock, allergen_tags)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
       RETURNING *`,
      [name, unit_id, intMoney(cost_per_unit ?? 0), intQty(min_stock ?? 0), max_stock != null ? intQty(max_stock) : null, startStock, tagsJson]
    );
    const row = rows[0];
    if (startStock > 0) {
      await pool.query(
        'INSERT INTO ingredient_lots (ingredient_id, quantity_remaining, expiry_date) VALUES ($1, $2, NULL)',
        [row.id, startStock]
      );
    }
    const { rows: full } = await pool.query(
      'SELECT i.*, u.name AS unit_name FROM ingredients i JOIN units u ON i.unit_id = u.id WHERE i.id = $1',
      [row.id]
    );
    res.status(201).json(full[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

api.patch('/ingredients/:id', requireKitchenManager, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { name, unit_id, cost_per_unit, min_stock, max_stock, current_stock, allergen_tags } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: before } = await client.query('SELECT current_stock FROM ingredients WHERE id = $1', [id]);
    if (before.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Ingredient not found' });
    }
    const oldStock = intQty(before[0].current_stock);
    const updates = [];
    const values = [];
    let i = 1;
    if (name !== undefined) { updates.push(`name = $${i++}`); values.push(name); }
    if (unit_id !== undefined) { updates.push(`unit_id = $${i++}`); values.push(unit_id); }
    if (cost_per_unit !== undefined) { updates.push(`cost_per_unit = $${i++}`); values.push(intMoney(cost_per_unit)); }
    if (min_stock !== undefined) { updates.push(`min_stock = $${i++}`); values.push(intQty(min_stock)); }
    if (max_stock !== undefined) { updates.push(`max_stock = $${i++}`); values.push(max_stock === null ? null : intQty(max_stock)); }
    if (current_stock !== undefined) { updates.push(`current_stock = $${i++}`); values.push(intQty(current_stock)); }
    if (allergen_tags !== undefined) { updates.push(`allergen_tags = $${i++}::jsonb`); values.push(JSON.stringify(normalizeAllergenTags(allergen_tags))); }
    if (updates.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No fields to update' });
    }
    values.push(id);
    await client.query(`UPDATE ingredients SET ${updates.join(', ')} WHERE id = $${i}`, values);
    if (current_stock !== undefined) {
      const newStock = intQty(current_stock);
      const delta = newStock - oldStock;
      if (delta !== 0) {
        await client.query(
          `INSERT INTO stock_movements (ingredient_id, quantity_change, movement_type, notes) VALUES ($1, $2, 'adjust', $3)`,
          [id, delta, 'Stock adjusted']
        );
      }
      await client.query('DELETE FROM ingredient_lots WHERE ingredient_id = $1', [id]);
      if (newStock > 0) {
        await client.query(
          'INSERT INTO ingredient_lots (ingredient_id, quantity_remaining, expiry_date) VALUES ($1, $2, NULL)',
          [id, newStock]
        );
      }
    }
    await client.query('COMMIT');
    const { rows } = await pool.query(
      'SELECT i.*, u.name AS unit_name FROM ingredients i JOIN units u ON i.unit_id = u.id WHERE i.id = $1',
      [id]
    );
    res.json(rows[0]);
  } catch (e) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {}
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

api.delete('/ingredients/:id', requireKitchenManager, async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM ingredients WHERE id = $1', [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Not found' });
    res.status(204).send();
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ----- Meals -----
api.get('/meals', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT m.*,
        COALESCE(
          (SELECT json_agg(json_build_object('ingredient_id', mi.ingredient_id, 'quantity', mi.quantity, 'ingredient_name', i.name, 'unit_name', u.name, 'cost_per_unit', i.cost_per_unit, 'allergen_tags', COALESCE(i.allergen_tags, '[]'::jsonb)))
          FROM meal_ingredients mi
          JOIN ingredients i ON mi.ingredient_id = i.id
          JOIN units u ON i.unit_id = u.id
          WHERE mi.meal_id = m.id),
          '[]'::json
        ) AS ingredients
      FROM meals m
      ORDER BY m.name
    `);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

api.post('/meals', requireKitchenManager, async (req, res) => {
  const { name, description, ingredients, meal_category, audience, schedule_days, schedule_flexible } = req.body;
  if (!name || String(name).trim() === '') {
    return res.status(400).json({ error: 'Meal name is required' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const daysJson = JSON.stringify(Array.isArray(schedule_days) ? schedule_days : []);
    const { rows: mealRows } = await client.query(
      `INSERT INTO meals (name, description, meal_category, audience, schedule_days, schedule_flexible)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6) RETURNING *`,
      [
        String(name).trim(),
        description ?? null,
        meal_category || 'lunch',
        audience || 'students',
        daysJson,
        Boolean(schedule_flexible)
      ]
    );
    const meal = mealRows[0];
    if (Array.isArray(ingredients)) {
      for (const row of ingredients) {
        const iid = parseInt(row.ingredient_id, 10);
        const q = intQty(row.quantity);
        if (!Number.isFinite(iid) || iid <= 0 || q <= 0) continue;
        await client.query(
          'INSERT INTO meal_ingredients (meal_id, ingredient_id, quantity) VALUES ($1, $2, $3)',
          [meal.id, iid, q]
        );
      }
    }
    const { rows: full } = await client.query(`
      SELECT m.*, COALESCE(
        (SELECT json_agg(json_build_object('ingredient_id', mi.ingredient_id, 'quantity', mi.quantity, 'ingredient_name', i.name, 'unit_name', u.name, 'cost_per_unit', i.cost_per_unit, 'allergen_tags', COALESCE(i.allergen_tags, '[]'::jsonb)))
        FROM meal_ingredients mi JOIN ingredients i ON mi.ingredient_id = i.id JOIN units u ON i.unit_id = u.id WHERE mi.meal_id = m.id),
        '[]'::json
      ) AS ingredients FROM meals m WHERE m.id = $1
    `, [meal.id]);
    if (!full?.length || !full[0]) {
      await client.query('ROLLBACK');
      return res.status(500).json({ error: 'Meal insert succeeded but reload failed. Try again.' });
    }
    await client.query('COMMIT');
    res.status(201).json(full[0]);
  } catch (e) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {}
    console.error('POST /api/meals', e);
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

api.patch('/meals/:id', requireKitchenManager, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id) || id <= 0) {
    return res.status(400).json({ error: 'Invalid meal id' });
  }
  const { name, description, ingredients, meal_category, audience, schedule_days, schedule_flexible } = req.body;
  const client = await pool.connect();
  try {
    if (name !== undefined) await client.query('UPDATE meals SET name = $1 WHERE id = $2', [name, id]);
    if (description !== undefined) await client.query('UPDATE meals SET description = $1 WHERE id = $2', [description, id]);
    if (meal_category !== undefined) await client.query('UPDATE meals SET meal_category = $1 WHERE id = $2', [meal_category, id]);
    if (audience !== undefined) await client.query('UPDATE meals SET audience = $1 WHERE id = $2', [audience, id]);
    if (schedule_days !== undefined) {
      const daysJson = JSON.stringify(Array.isArray(schedule_days) ? schedule_days : []);
      await client.query('UPDATE meals SET schedule_days = $1::jsonb WHERE id = $2', [daysJson, id]);
    }
    if (schedule_flexible !== undefined) {
      await client.query('UPDATE meals SET schedule_flexible = $1 WHERE id = $2', [Boolean(schedule_flexible), id]);
    }
    if (Array.isArray(ingredients)) {
      await client.query('DELETE FROM meal_ingredients WHERE meal_id = $1', [id]);
      for (const row of ingredients) {
        const iid = parseInt(row.ingredient_id, 10);
        const q = intQty(row.quantity);
        if (!Number.isFinite(iid) || iid <= 0 || q <= 0) continue;
        await client.query(
          'INSERT INTO meal_ingredients (meal_id, ingredient_id, quantity) VALUES ($1, $2, $3)',
          [id, iid, q]
        );
      }
    }
    const { rows } = await pool.query(`
      SELECT m.*, COALESCE(
        (SELECT json_agg(json_build_object('ingredient_id', mi.ingredient_id, 'quantity', mi.quantity, 'ingredient_name', i.name, 'unit_name', u.name, 'cost_per_unit', i.cost_per_unit, 'allergen_tags', COALESCE(i.allergen_tags, '[]'::jsonb)))
        FROM meal_ingredients mi JOIN ingredients i ON mi.ingredient_id = i.id JOIN units u ON i.unit_id = u.id WHERE mi.meal_id = m.id),
        '[]'::json
      ) AS ingredients FROM meals m WHERE m.id = $1
    `, [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Meal not found' });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

api.delete('/meals/:id', requireKitchenManager, async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM meals WHERE id = $1', [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Not found' });
    res.status(204).send();
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ----- Prepare meal: deduct inventory, FIFO lots, stock_movements, preparation -----
api.post('/meals/:id/prepare', async (req, res) => {
  const mealId = parseInt(req.params.id, 10);
  const quantity = Math.max(1, parseInt(req.body.quantity, 10) || 1);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: mealRows } = await client.query(`
      SELECT mi.ingredient_id, mi.quantity, i.current_stock, i.name AS ingredient_name, u.name AS unit_name, i.cost_per_unit
      FROM meal_ingredients mi
      JOIN ingredients i ON mi.ingredient_id = i.id
      JOIN units u ON i.unit_id = u.id
      WHERE mi.meal_id = $1
    `, [mealId]);
    if (mealRows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Meal not found or has no ingredients' });
    }

    let totalCost = 0;
    for (const row of mealRows) {
      const needed = intQty(row.quantity) * quantity;
      if (intQty(row.current_stock) < needed) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: 'Insufficient stock',
          detail: `${row.ingredient_name}: need ${needed} ${row.unit_name}, have ${intQty(row.current_stock)}`
        });
      }
      totalCost += needed * intMoney(row.cost_per_unit);
    }
    totalCost = intMoney(totalCost);

    const { rows: prepRows } = await client.query(
      'INSERT INTO preparations (meal_id, quantity_prepared, total_cost) VALUES ($1, $2, $3) RETURNING *',
      [mealId, quantity, totalCost]
    );
    const prepId = prepRows[0].id;

    for (const row of mealRows) {
      const deduct = intQty(row.quantity) * quantity;
      await client.query(
        'UPDATE ingredients SET current_stock = current_stock - $1 WHERE id = $2',
        [deduct, row.ingredient_id]
      );
      await ensureLotsForIngredient(client, row.ingredient_id);
      await deductLotsFifo(client, row.ingredient_id, deduct);
      await client.query(
        `INSERT INTO stock_movements (ingredient_id, quantity_change, movement_type, preparation_id, notes)
         VALUES ($1, $2, 'prepare', $3, NULL)`,
        [row.ingredient_id, -deduct, prepId]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({
      preparation: prepRows[0],
      total_cost: intMoney(prepRows[0].total_cost),
      deducted: mealRows.map(r => ({
        ingredient_id: r.ingredient_id,
        quantity_deducted: intQty(r.quantity) * quantity,
        unit: r.unit_name
      }))
    });
  } catch (e) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {}
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

// ----- Preparations history -----
api.get('/preparations', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT p.*, m.name AS meal_name
      FROM preparations p
      JOIN meals m ON p.meal_id = m.id
      ORDER BY p.prepared_at DESC
      LIMIT 200
    `);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ----- Inventory purchases (money spent on stock) -----
api.get('/inventory-purchases', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT * FROM inventory_purchases ORDER BY purchased_at DESC LIMIT 200
    `);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

api.post('/inventory-purchases', requireKitchenManager, async (req, res) => {
  const { amount, description, purchased_at, supplier_name } = req.body;
  const n = intMoney(amount);
  if (n < 0) return res.status(400).json({ error: 'Invalid amount' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO inventory_purchases (amount, description, purchased_at, supplier_name)
       VALUES ($1, $2, COALESCE($3::timestamptz, NOW()), $4) RETURNING *`,
      [n, description || null, purchased_at || null, supplier_name || null]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ----- Receive stock (physical intake + lot / expiry) -----
api.post('/inventory/receive', async (req, res) => {
  const { ingredient_id, quantity, expiry_date, notes } = req.body;
  const iid = parseInt(ingredient_id, 10);
  const qty = intQty(quantity);
  if (!Number.isFinite(iid) || iid <= 0 || qty <= 0) {
    return res.status(400).json({ error: 'Valid ingredient_id and positive quantity required' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rowCount } = await client.query('UPDATE ingredients SET current_stock = current_stock + $1 WHERE id = $2', [qty, iid]);
    if (rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Ingredient not found' });
    }
    await client.query(
      'INSERT INTO ingredient_lots (ingredient_id, quantity_remaining, expiry_date) VALUES ($1, $2, $3::date)',
      [iid, qty, expiry_date || null]
    );
    await client.query(
      `INSERT INTO stock_movements (ingredient_id, quantity_change, movement_type, notes) VALUES ($1, $2, 'receive', $3)`,
      [iid, qty, notes || null]
    );
    await client.query('COMMIT');
    const { rows } = await pool.query(
      'SELECT i.*, u.name AS unit_name FROM ingredients i JOIN units u ON i.unit_id = u.id WHERE i.id = $1',
      [iid]
    );
    res.status(201).json({ ingredient: rows[0] });
  } catch (e) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {}
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

// ----- Record waste / spoilage -----
api.post('/inventory/waste', async (req, res) => {
  const { ingredient_id, quantity, notes } = req.body;
  const iid = parseInt(ingredient_id, 10);
  const qty = intQty(quantity);
  if (!Number.isFinite(iid) || iid <= 0 || qty <= 0) {
    return res.status(400).json({ error: 'Valid ingredient_id and positive quantity required' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: cur } = await client.query('SELECT current_stock FROM ingredients WHERE id = $1', [iid]);
    if (cur.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Ingredient not found' });
    }
    if (intQty(cur[0].current_stock) < qty) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Not enough stock to record this waste' });
    }
    await client.query('UPDATE ingredients SET current_stock = current_stock - $1 WHERE id = $2', [qty, iid]);
    await ensureLotsForIngredient(client, iid);
    await deductLotsFifo(client, iid, qty);
    await client.query(
      `INSERT INTO stock_movements (ingredient_id, quantity_change, movement_type, notes) VALUES ($1, $2, 'waste', $3)`,
      [iid, -qty, notes || null]
    );
    await client.query('COMMIT');
    const { rows } = await pool.query(
      'SELECT i.*, u.name AS unit_name FROM ingredients i JOIN units u ON i.unit_id = u.id WHERE i.id = $1',
      [iid]
    );
    res.status(201).json({ ingredient: rows[0] });
  } catch (e) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {}
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

// ----- Stock movement audit log -----
api.get('/stock-movements', async (req, res) => {
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 80));
  try {
    const { rows } = await pool.query(
      `
      SELECT sm.*, i.name AS ingredient_name, u.name AS unit_name
      FROM stock_movements sm
      JOIN ingredients i ON sm.ingredient_id = i.id
      JOIN units u ON i.unit_id = u.id
      ORDER BY sm.created_at DESC
      LIMIT $1
      `,
      [limit]
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ----- Pupil allergy watch list (school safeguarding) -----
api.get('/pupil-allergies', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM pupil_allergies WHERE active = true ORDER BY pupil_name'
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

api.post('/pupil-allergies', requireKitchenManager, async (req, res) => {
  const { pupil_name, allergen_tags, notes } = req.body;
  if (!pupil_name || String(pupil_name).trim() === '') {
    return res.status(400).json({ error: 'pupil_name is required' });
  }
  try {
    const tags = JSON.stringify(normalizeAllergenTags(allergen_tags));
    const { rows } = await pool.query(
      `INSERT INTO pupil_allergies (pupil_name, allergen_tags, notes) VALUES ($1, $2::jsonb, $3) RETURNING *`,
      [String(pupil_name).trim(), tags, notes || null]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

api.patch('/pupil-allergies/:id', requireKitchenManager, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { pupil_name, allergen_tags, notes, active } = req.body;
  const updates = [];
  const values = [];
  let i = 1;
  if (pupil_name !== undefined) { updates.push(`pupil_name = $${i++}`); values.push(String(pupil_name).trim()); }
  if (allergen_tags !== undefined) { updates.push(`allergen_tags = $${i++}::jsonb`); values.push(JSON.stringify(normalizeAllergenTags(allergen_tags))); }
  if (notes !== undefined) { updates.push(`notes = $${i++}`); values.push(notes); }
  if (active !== undefined) { updates.push(`active = $${i++}`); values.push(Boolean(active)); }
  if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
  values.push(id);
  try {
    const { rows } = await pool.query(
      `UPDATE pupil_allergies SET ${updates.join(', ')} WHERE id = $${i} RETURNING *`,
      values
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

api.delete('/pupil-allergies/:id', requireKitchenManager, async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM pupil_allergies WHERE id = $1', [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Not found' });
    res.status(204).send();
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ----- Daily planned / served portions -----
api.get('/daily-servings', async (req, res) => {
  const d = req.query.date || new Date().toISOString().slice(0, 10);
  try {
    const { rows } = await pool.query(
      'SELECT * FROM daily_serving_counts WHERE service_date = $1::date ORDER BY meal_category, audience',
      [d]
    );
    res.json({ date: d, rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

api.post('/daily-servings', requireKitchenManager, async (req, res) => {
  const { service_date, meal_category, audience, planned_portions, served_portions } = req.body;
  const d = service_date || new Date().toISOString().slice(0, 10);
  if (!meal_category || !audience) {
    return res.status(400).json({ error: 'meal_category and audience required' });
  }
  try {
    const { rows } = await pool.query(
      `
      INSERT INTO daily_serving_counts (service_date, meal_category, audience, planned_portions, served_portions)
      VALUES ($1::date, $2, $3, $4, $5)
      ON CONFLICT (service_date, meal_category, audience)
      DO UPDATE SET
        planned_portions = EXCLUDED.planned_portions,
        served_portions = EXCLUDED.served_portions
      RETURNING *
      `,
      [d, meal_category, audience, intQty(planned_portions ?? 0), served_portions == null ? null : intQty(served_portions)]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ----- Temperature checks (HACCP support) -----
api.get('/temperature-checks', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM temperature_checks ORDER BY checked_at DESC LIMIT 100'
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

api.post('/temperature-checks', requireKitchenManager, async (req, res) => {
  const { zone_label, temp_c, ok, notes } = req.body;
  if (!zone_label || String(zone_label).trim() === '') {
    return res.status(400).json({ error: 'zone_label is required' });
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO temperature_checks (zone_label, temp_c, ok, notes) VALUES ($1, $2, COALESCE($3, true), $4) RETURNING *`,
      [String(zone_label).trim(), temp_c != null ? Number(temp_c) : null, ok, notes || null]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ----- Dashboard summary + activity -----
api.get('/dashboard-summary', async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const { rows: planned } = await pool.query(
      `SELECT COALESCE(SUM(planned_portions), 0)::int AS s FROM daily_serving_counts WHERE service_date = CURRENT_DATE`
    );
    const { rows: costToday } = await pool.query(
      `SELECT COALESCE(SUM(total_cost), 0) AS s FROM preparations WHERE prepared_at::date = CURRENT_DATE`
    );
    const { rows: lowc } = await pool.query(
      `SELECT COUNT(*)::int AS c FROM ingredients WHERE current_stock < min_stock`
    );
    const { rows: pupils } = await pool.query(
      `SELECT COUNT(*)::int AS c FROM pupil_allergies WHERE active = true`
    );
    const { rows: week } = await pool.query(`
      SELECT d::date AS day,
        COALESCE((SELECT SUM(total_cost) FROM preparations WHERE prepared_at::date = d::date), 0)
        + COALESCE((SELECT SUM(amount) FROM inventory_purchases WHERE purchased_at::date = d::date), 0) AS spent
      FROM generate_series(CURRENT_DATE - 6, CURRENT_DATE, '1 day'::interval) d
      ORDER BY day
    `);
    res.json({
      today_date: today,
      planned_portions_today: intQty(planned[0]?.s),
      food_cost_today_ugx: intMoney(costToday[0]?.s),
      low_stock_count: intQty(lowc[0]?.c),
      pupils_on_allergy_watch: intQty(pupils[0]?.c),
      weekly_spend: week.map(r => ({ date: r.day, amount_ugx: intMoney(r.spent) }))
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

api.get('/activity-feed', async (req, res) => {
  try {
    const { rows: mov } = await pool.query(`
      SELECT sm.created_at, sm.movement_type, sm.quantity_change, i.name AS ingredient_name, u.name AS unit_name
      FROM stock_movements sm
      JOIN ingredients i ON sm.ingredient_id = i.id
      JOIN units u ON i.unit_id = u.id
      ORDER BY sm.created_at DESC
      LIMIT 14
    `);
    const { rows: temps } = await pool.query(`
      SELECT id, zone_label, temp_c, ok, notes, checked_at FROM temperature_checks ORDER BY checked_at DESC LIMIT 6
    `);
    res.json({ stock_movements: mov, temperature_checks: temps });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ----- Budget: current period and usage (meal prep + inventory purchases) -----
api.get('/budget', async (req, res) => {
  try {
    const { rows: period } = await pool.query(`
      SELECT * FROM budget_settings
      WHERE period_start <= CURRENT_DATE AND period_end >= CURRENT_DATE
      ORDER BY period_start DESC LIMIT 1
    `);
    const p = period[0];
    let spentMeals = 0;
    let spentInventory = 0;
    if (p) {
      const { rows: m } = await pool.query(
        `
        SELECT COALESCE(SUM(total_cost), 0) AS s FROM preparations
        WHERE prepared_at::date >= $1::date AND prepared_at::date <= $2::date
        `,
        [p.period_start, p.period_end]
      );
      const { rows: i } = await pool.query(
        `
        SELECT COALESCE(SUM(amount), 0) AS s FROM inventory_purchases
        WHERE purchased_at::date >= $1::date AND purchased_at::date <= $2::date
        `,
        [p.period_start, p.period_end]
      );
      spentMeals = intMoney(m[0]?.s || 0);
      spentInventory = intMoney(i[0]?.s || 0);
    } else {
      const { rows: m } = await pool.query(
        'SELECT COALESCE(SUM(total_cost), 0) AS s FROM preparations'
      );
      const { rows: i } = await pool.query(
        'SELECT COALESCE(SUM(amount), 0) AS s FROM inventory_purchases'
      );
      spentMeals = intMoney(m[0]?.s || 0);
      spentInventory = intMoney(i[0]?.s || 0);
    }
    const spent = intMoney(spentMeals + spentInventory);
    const budget = p ? intMoney(p.budget_amount) : null;
    res.json({
      period: p || null,
      budget_amount: budget,
      spent_meals: spentMeals,
      spent_inventory: spentInventory,
      spent,
      remaining: budget != null ? intMoney(budget - spent) : null,
      usage_percent: budget != null && budget > 0 ? Math.min(100, (spent / budget) * 100) : null
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

api.post('/budget', requireKitchenManager, async (req, res) => {
  const { period_start, period_end, budget_amount } = req.body;
  try {
    const { rows } = await pool.query(
      'INSERT INTO budget_settings (period_start, period_end, budget_amount) VALUES ($1, $2, $3) RETURNING *',
      [period_start, period_end, intMoney(budget_amount)]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ----- Alerts: low stock, surplus, expiring lots -----
api.get('/alerts', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT i.id, i.name, u.name AS unit_name, i.current_stock, i.min_stock, i.max_stock,
        CASE WHEN i.max_stock IS NOT NULL AND i.current_stock > i.max_stock THEN true ELSE false END AS surplus,
        CASE WHEN i.current_stock < i.min_stock THEN true ELSE false END AS low_stock
      FROM ingredients i
      JOIN units u ON i.unit_id = u.id
      WHERE i.current_stock < i.min_stock OR (i.max_stock IS NOT NULL AND i.current_stock > i.max_stock)
      ORDER BY i.current_stock ASC
    `);
    const lowStock = rows.filter(r => r.low_stock);
    const surplus = rows.filter(r => r.surplus);
    const { rows: expiring } = await pool.query(`
      SELECT l.id, l.expiry_date, l.quantity_remaining, i.name AS ingredient_name, u.name AS unit_name
      FROM ingredient_lots l
      JOIN ingredients i ON l.ingredient_id = i.id
      JOIN units u ON i.unit_id = u.id
      WHERE l.quantity_remaining > 0
        AND l.expiry_date IS NOT NULL
        AND l.expiry_date <= CURRENT_DATE + 7
      ORDER BY l.expiry_date ASC
      LIMIT 30
    `);
    const { rows: pupilc } = await pool.query(
      'SELECT COUNT(*)::int AS c FROM pupil_allergies WHERE active = true'
    );
    res.json({
      low_stock: lowStock,
      surplus,
      expiring_soon: expiring,
      pupils_on_allergy_watch: intQty(pupilc[0]?.c)
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ----- User accounts (admin only) -----
api.get('/users', requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, username, display_name, role, full_dashboard, active, created_at
       FROM users ORDER BY lower(username)`
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

api.post('/users', requireAdmin, async (req, res) => {
  const { username, password, display_name, role, full_dashboard } = req.body;
  const un = String(username || '').trim().toLowerCase();
  if (!un || !password) return res.status(400).json({ error: 'Username and password required' });
  const r = role === 'admin' ? 'admin' : 'chef';
  const fd = r === 'admin' ? true : Boolean(full_dashboard);
  const hash = bcrypt.hashSync(String(password), 10);
  try {
    const { rows } = await pool.query(
      `INSERT INTO users (username, password_hash, display_name, role, full_dashboard)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, username, display_name, role, full_dashboard, active, created_at`,
      [un, hash, display_name || un, r, fd]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(400).json({ error: 'Username already exists' });
    res.status(500).json({ error: e.message });
  }
});

api.patch('/users/:id', requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: 'Invalid user id' });
  const { display_name, password, full_dashboard, active, role } = req.body;
  if (id === req.session.userId) {
    if (active === false) return res.status(400).json({ error: 'You cannot deactivate yourself' });
    if (role !== undefined && role !== 'admin') return res.status(400).json({ error: 'You cannot change your own role' });
  }
  try {
    const { rows: cur } = await pool.query('SELECT role FROM users WHERE id = $1', [id]);
    if (cur.length === 0) return res.status(404).json({ error: 'User not found' });
    const updates = [];
    const values = [];
    let i = 1;
    if (display_name !== undefined) {
      updates.push(`display_name = $${i++}`);
      values.push(String(display_name).trim() || null);
    }
    if (password !== undefined && String(password).length > 0) {
      updates.push(`password_hash = $${i++}`);
      values.push(bcrypt.hashSync(String(password), 10));
    }
    if (full_dashboard !== undefined && cur[0].role === 'chef') {
      updates.push(`full_dashboard = $${i++}`);
      values.push(Boolean(full_dashboard));
    }
    if (active !== undefined) {
      updates.push(`active = $${i++}`);
      values.push(Boolean(active));
    }
    if (role !== undefined) {
      const nr = role === 'admin' ? 'admin' : 'chef';
      updates.push(`role = $${i++}`);
      values.push(nr);
      if (nr === 'admin') {
        updates.push(`full_dashboard = $${i++}`);
        values.push(true);
      }
    }
    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
    values.push(id);
    const { rows } = await pool.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${i} RETURNING id, username, display_name, role, full_dashboard, active, created_at`,
      values
    );
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.use('/api', api);

app.use(express.static(path.join(__dirname, 'public')));

// SPA fallback (never serve HTML for API paths — avoids false "logged out" loops)
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  const wantsJson =
    req.path.startsWith('/api/') ||
    (req.headers.accept && String(req.headers.accept).includes('application/json'));
  if (wantsJson) {
    return res.status(500).json({ error: err.message || 'Server error' });
  }
  res.status(500).send('Server error');
});

app.listen(PORT, () => {
  if (IS_PRODUCTION && SESSION_SECRET === 'kitchen-dev-secret-change-in-production') {
    console.warn('[kitchen] Set SESSION_SECRET in .env for production');
  }
  console.log(`Kitchen Management server running at http://localhost:${PORT}`);
});
