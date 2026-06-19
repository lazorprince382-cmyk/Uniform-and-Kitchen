-- Sample data (idempotent) — run after schema

INSERT INTO ingredients (name, unit_id, cost_per_unit, min_stock, max_stock, current_stock)
SELECT 'Rice', u.id, 2.50, 10, 100, 50
FROM units u WHERE u.name = 'kg'
AND NOT EXISTS (SELECT 1 FROM ingredients WHERE name = 'Rice');

INSERT INTO ingredients (name, unit_id, cost_per_unit, min_stock, max_stock, current_stock)
SELECT 'Vegetable Oil', u.id, 4.00, 2, 20, 8
FROM units u WHERE u.name = 'L'
AND NOT EXISTS (SELECT 1 FROM ingredients WHERE name = 'Vegetable Oil');

INSERT INTO ingredients (name, unit_id, cost_per_unit, min_stock, max_stock, current_stock)
SELECT 'Salt', u.id, 0.50, 1, 10, 5
FROM units u WHERE u.name = 'g'
AND NOT EXISTS (SELECT 1 FROM ingredients WHERE name = 'Salt');

INSERT INTO ingredients (name, unit_id, cost_per_unit, min_stock, max_stock, current_stock)
SELECT 'Tomatoes', u.id, 1.20, 5, 50, 25
FROM units u WHERE u.name = 'kg'
AND NOT EXISTS (SELECT 1 FROM ingredients WHERE name = 'Tomatoes');

INSERT INTO ingredients (name, unit_id, cost_per_unit, min_stock, max_stock, current_stock)
SELECT 'Onions', u.id, 0.80, 3, 30, 15
FROM units u WHERE u.name = 'kg'
AND NOT EXISTS (SELECT 1 FROM ingredients WHERE name = 'Onions');

-- Sync opening lots for seeded stock (after migration v3)
INSERT INTO ingredient_lots (ingredient_id, quantity_remaining, expiry_date)
SELECT i.id, ROUND(i.current_stock)::int, NULL
FROM ingredients i
WHERE i.current_stock > 0
  AND NOT EXISTS (SELECT 1 FROM ingredient_lots l WHERE l.ingredient_id = i.id);
