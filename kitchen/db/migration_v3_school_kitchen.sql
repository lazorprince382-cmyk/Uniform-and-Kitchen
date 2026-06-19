-- School kitchen: allergens, stock audit, lots/expiry, servings, temps, supplier on purchases

ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS allergen_tags JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE inventory_purchases ADD COLUMN IF NOT EXISTS supplier_name VARCHAR(200);

CREATE TABLE IF NOT EXISTS ingredient_lots (
  id SERIAL PRIMARY KEY,
  ingredient_id INT NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  quantity_remaining INT NOT NULL CHECK (quantity_remaining >= 0),
  expiry_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lots_ingredient ON ingredient_lots(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_lots_expiry ON ingredient_lots(expiry_date);

CREATE TABLE IF NOT EXISTS stock_movements (
  id SERIAL PRIMARY KEY,
  ingredient_id INT NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  quantity_change INT NOT NULL,
  movement_type VARCHAR(24) NOT NULL,
  preparation_id INT REFERENCES preparations(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_stock_mov_ing ON stock_movements(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_stock_mov_at ON stock_movements(created_at DESC);

CREATE TABLE IF NOT EXISTS pupil_allergies (
  id SERIAL PRIMARY KEY,
  pupil_name VARCHAR(120) NOT NULL,
  allergen_tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS daily_serving_counts (
  id SERIAL PRIMARY KEY,
  service_date DATE NOT NULL,
  meal_category VARCHAR(20) NOT NULL,
  audience VARCHAR(20) NOT NULL,
  planned_portions INT NOT NULL DEFAULT 0,
  served_portions INT,
  UNIQUE(service_date, meal_category, audience)
);

CREATE TABLE IF NOT EXISTS temperature_checks (
  id SERIAL PRIMARY KEY,
  zone_label VARCHAR(120) NOT NULL,
  temp_c NUMERIC(5,2),
  ok BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One opening lot per ingredient so FIFO matches existing stock (idempotent)
INSERT INTO ingredient_lots (ingredient_id, quantity_remaining, expiry_date)
SELECT i.id, i.current_stock::int, NULL
FROM ingredients i
WHERE i.current_stock > 0
  AND NOT EXISTS (SELECT 1 FROM ingredient_lots l WHERE l.ingredient_id = i.id);
