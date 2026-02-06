-- Seed script for initial admin user and sample data
-- Run this after schema.sql

-- Note: The password hash below is for '103piCKle668!'
-- Generated using bcrypt with 10 salt rounds
-- You should regenerate this hash using the Node.js script below or change the password

-- First, insert the admin user
-- Password: 103piCKle668!
INSERT INTO users (email, password_hash, name, role)
VALUES (
  'jszurls@gmail.com',
  '$2b$10$placeholder_hash_replace_with_actual',
  'Admin',
  'admin'
) ON CONFLICT (email) DO NOTHING;

-- Sample groups
INSERT INTO groups (name, description) VALUES
  ('Morning Players', 'Early morning pickleball sessions'),
  ('Weekend Warriors', 'Weekend games for all skill levels'),
  ('Competitive League', 'For players looking for competitive matches')
ON CONFLICT DO NOTHING;

-- Sample locations
INSERT INTO locations (name, address) VALUES
  ('Community Recreation Center', '123 Main Street, Anytown, USA'),
  ('City Park Courts', '456 Park Avenue, Anytown, USA'),
  ('YMCA Indoor Courts', '789 Fitness Lane, Anytown, USA')
ON CONFLICT DO NOTHING;
