import pool from '../db/pool.js';

export async function syncProductTotal(client, productId) {
  const db = client || pool;
  await db.query(
    `UPDATE products SET current_stock = COALESCE((
       SELECT SUM(quantity) FROM inventory_stock WHERE product_id = $1
     ), 0), updated_at = NOW() WHERE id = $1`,
    [productId]
  );
}

export async function adjustStock(client, { product_id, size, quantity, type, notes, created_by, reference_type, reference_id }) {
  const { rows: existing } = await client.query(
    `SELECT id, quantity FROM inventory_stock WHERE product_id = $1 AND size = $2`,
    [product_id, size]
  );

  if (quantity < 0 && (!existing[0] || existing[0].quantity + quantity < 0)) {
    throw new Error(`Insufficient stock for size ${size}`);
  }

  if (existing[0]) {
    await client.query(
      `UPDATE inventory_stock SET quantity = quantity + $1, updated_at = NOW() WHERE id = $2`,
      [quantity, existing[0].id]
    );
  } else if (quantity > 0) {
    await client.query(
      `INSERT INTO inventory_stock (product_id, size, quantity) VALUES ($1, $2, $3)`,
      [product_id, size, quantity]
    );
  } else {
    throw new Error(`No stock for size ${size}`);
  }

  const { rows } = await client.query(
    `INSERT INTO stock_transactions (product_id, size, quantity, type, notes, created_by, reference_type, reference_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [product_id, size, quantity, type, notes, created_by, reference_type, reference_id]
  );

  await syncProductTotal(client, product_id);
  return rows[0];
}

/** Replace per-size stock rows for a product (used from product edit). */
export async function setProductSizes(client, productId, sizes = []) {
  const normalized = sizes
    .map((s) => ({
      size: String(s.size || '').trim(),
      quantity: Math.max(0, parseInt(s.quantity, 10) || 0),
    }))
    .filter((s) => s.size);

  const keep = new Set(normalized.map((s) => s.size));

  const { rows: existing } = await client.query(
    `SELECT size FROM inventory_stock WHERE product_id = $1`,
    [productId]
  );

  for (const row of existing) {
    if (!keep.has(row.size)) {
      await client.query(`DELETE FROM inventory_stock WHERE product_id = $1 AND size = $2`, [
        productId,
        row.size,
      ]);
    }
  }

  for (const { size, quantity } of normalized) {
    if (quantity <= 0) {
      await client.query(`DELETE FROM inventory_stock WHERE product_id = $1 AND size = $2`, [
        productId,
        size,
      ]);
    } else {
      await client.query(
        `INSERT INTO inventory_stock (product_id, size, quantity)
         VALUES ($1, $2, $3)
         ON CONFLICT (product_id, size)
         DO UPDATE SET quantity = EXCLUDED.quantity, updated_at = NOW()`,
        [productId, size, quantity]
      );
    }
  }

  await syncProductTotal(client, productId);
}
