// Database configuration with PostgreSQL/SQLite fallback
const USE_SQLITE = process.env.USE_SQLITE === 'true' || !process.env.DATABASE_URL;

let pool;

if (USE_SQLITE) {
  pool = require('./db-sqlite');
  console.log('Using SQLite database');
} else {
  const { Pool } = require('pg');

  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('railway')
      ? { rejectUnauthorized: false }
      : false
  });

  pool.on('connect', () => {
    console.log('Connected to PostgreSQL database');
  });

  pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1);
  });

  // Initialize PostgreSQL schema on first run
  const initPostgres = async () => {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          name TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'pending' CHECK (role IN ('pending', 'member', 'admin')),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS groups (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS user_groups (
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE,
          joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (user_id, group_id)
        )
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS locations (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          address TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS events (
          id SERIAL PRIMARY KEY,
          group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE NOT NULL,
          creator_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
          location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL,
          title TEXT NOT NULL,
          event_date DATE NOT NULL,
          start_time TIME NOT NULL,
          end_time TIME NOT NULL,
          max_spots INTEGER NOT NULL CHECK (max_spots > 0),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS reservations (
          id SERIAL PRIMARY KEY,
          event_id INTEGER REFERENCES events(id) ON DELETE CASCADE NOT NULL,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE (event_id, user_id)
        )
      `);

      // Create indexes
      await pool.query('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_events_group_id ON events(group_id)');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_events_event_date ON events(event_date)');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_reservations_event_id ON reservations(event_id)');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_reservations_user_id ON reservations(user_id)');

      console.log('PostgreSQL schema initialized');
    } catch (err) {
      console.error('Failed to initialize PostgreSQL schema:', err);
    }
  };

  initPostgres();
}

module.exports = pool;
