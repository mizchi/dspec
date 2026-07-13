-- Existing application schema used to seed patterns.db from real DDL.
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS posts (
  id INTEGER,
  author_id TEXT NOT NULL REFERENCES users(id),
  slug TEXT NOT NULL,
  title VARCHAR(255) NOT NULL,
  published BOOLEAN NOT NULL DEFAULT FALSE,
  published_at TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE (slug)
);
