-- Database schema for Nav - Cloudflare Worker Navigation Site
-- Run this to initialize database structure
-- After running this, you need to create your own admin user

-- ============================================
-- Drop and recreate tables
-- ============================================

-- Drop existing tables (order matters due to foreign keys)
DROP TABLE IF EXISTS links;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS users;

-- Users table for admin authentication
-- status: 1=active, 0=disabled
-- user_id=1 is super admin (cannot be deleted or disabled)
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    status INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Categories table
CREATE TABLE categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Links table
CREATE TABLE links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    category_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    icon TEXT DEFAULT '',
    sort_order INTEGER DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);

-- ============================================
-- Create indexes for better query performance
-- ============================================

CREATE INDEX idx_links_category ON links(category_id);
CREATE INDEX idx_links_user ON links(user_id);
CREATE INDEX idx_categories_sort ON categories(sort_order);
CREATE INDEX idx_categories_user ON categories(user_id);
CREATE INDEX idx_links_sort ON links(sort_order);

-- ============================================
-- Create default admin user
-- IMPORTANT: Change the password after first login!
-- Default password: admin123
-- SHA-256 hash of 'admin123'
-- ============================================

INSERT INTO users (username, password_hash, status) VALUES
('admin', '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', 1);
