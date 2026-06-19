-- Seed data for School Internal Uniform System

INSERT INTO roles (name, description, permissions) VALUES
  ('Administrator', 'Full system access', '["*"]'::jsonb),
  ('Manager', 'Inventory and uniform desk management', '["dashboard","inventory","orders","reports"]'::jsonb),
  ('Staff', 'Uniform counter operations', '["dashboard","orders","stock_in","stock_out"]'::jsonb)
ON CONFLICT DO NOTHING;

INSERT INTO users (email, password_hash, full_name, role_id) VALUES
  ('bursar@toks.com', '$2a$10$rQZ8K8Y5Y5Y5Y5Y5Y5Y5YuGKxGxGxGxGxGxGxGxGxGxGxGxGxGxG', 'School Bursar', 1)
ON CONFLICT (email) DO NOTHING;

INSERT INTO categories (name, description, color_code) VALUES
  ('Uniform Store', 'Standard school uniforms', '#3b82f6'),
  ('Sports Wear', 'Sports and PE uniforms', '#8b5cf6'),
  ('Track Suits', 'Track suits and athletic wear', '#06b6d4'),
  ('Socks', 'School socks and accessories', '#f59e0b')
ON CONFLICT DO NOTHING;
