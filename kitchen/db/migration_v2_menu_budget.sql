-- Meal scheduling, audience, category + inventory purchase spending

CREATE TABLE IF NOT EXISTS inventory_purchases (
  id SERIAL PRIMARY KEY,
  amount DECIMAL(12,2) NOT NULL,
  description TEXT,
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_purchases_at ON inventory_purchases(purchased_at);

ALTER TABLE meals ADD COLUMN IF NOT EXISTS meal_category VARCHAR(20) NOT NULL DEFAULT 'lunch';
ALTER TABLE meals ADD COLUMN IF NOT EXISTS audience VARCHAR(20) NOT NULL DEFAULT 'students';
ALTER TABLE meals ADD COLUMN IF NOT EXISTS schedule_days JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE meals ADD COLUMN IF NOT EXISTS schedule_flexible BOOLEAN NOT NULL DEFAULT false;
