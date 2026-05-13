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
          phone TEXT,
          role TEXT NOT NULL DEFAULT 'pending' CHECK (role IN ('pending', 'member', 'admin')),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Add phone column if it doesn't exist (migration for existing databases)
      await pool.query(`
        ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT
      `).catch(() => {});

      // Add player profile columns (migration for existing databases)
      await pool.query(`
        ALTER TABLE users ADD COLUMN IF NOT EXISTS level_of_play TEXT
      `).catch(() => {});
      await pool.query(`
        ALTER TABLE users ADD COLUMN IF NOT EXISTS dupr_rating NUMERIC(3,1)
      `).catch(() => {});
      await pool.query(`
        ALTER TABLE users ADD COLUMN IF NOT EXISTS certified_rating BOOLEAN DEFAULT false
      `).catch(() => {});

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
          guest_count INTEGER NOT NULL DEFAULT 0 CHECK (guest_count >= 0 AND guest_count <= 3),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE (event_id, user_id)
        )
      `);

      // Add guest_count column if it doesn't exist (migration for existing databases)
      await pool.query(`
        ALTER TABLE reservations ADD COLUMN IF NOT EXISTS guest_count INTEGER NOT NULL DEFAULT 0
      `).catch(() => {});

      await pool.query(`
        CREATE TABLE IF NOT EXISTS group_locations (
          group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE,
          location_id INTEGER REFERENCES locations(id) ON DELETE CASCADE,
          PRIMARY KEY (group_id, location_id)
        )
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS group_requests (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
          group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE (user_id, group_id)
        )
      `);

      // Create indexes
      await pool.query('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_events_group_id ON events(group_id)');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_events_event_date ON events(event_date)');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_reservations_event_id ON reservations(event_id)');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_reservations_user_id ON reservations(user_id)');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_group_locations_group_id ON group_locations(group_id)');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_group_locations_location_id ON group_locations(location_id)');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_group_requests_user_id ON group_requests(user_id)');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_group_requests_group_id ON group_requests(group_id)');

      // --- Pulse feature: user prefs, away mode, push subscription ---
      await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS default_group_id INTEGER REFERENCES groups(id) ON DELETE SET NULL`).catch(() => {});
      await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS default_location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL`).catch(() => {});
      await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS usual_morning_start TIME DEFAULT '08:00'`).catch(() => {});
      await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS usual_evening_start TIME DEFAULT '18:00'`).catch(() => {});
      await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS usual_duration_min INTEGER DEFAULT 90`).catch(() => {});
      await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS away_start_date DATE`).catch(() => {});
      await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS away_end_date DATE`).catch(() => {});
      await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS push_subscription JSONB`).catch(() => {});

      await pool.query(`ALTER TABLE groups ADD COLUMN IF NOT EXISTS min_players INTEGER DEFAULT 4`).catch(() => {});

      await pool.query(`
        CREATE TABLE IF NOT EXISTS pulses (
          id SERIAL PRIMARY KEY,
          group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
          creator_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL,
          pulse_date DATE NOT NULL,
          start_time TIME NOT NULL,
          end_time TIME NOT NULL,
          status VARCHAR(16) NOT NULL DEFAULT 'active',
          created_at TIMESTAMPTZ DEFAULT NOW(),
          archived_at TIMESTAMPTZ
        )
      `);
      await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS one_active_pulse_per_group ON pulses (group_id) WHERE status = 'active'`).catch(() => {});
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_pulses_group_status ON pulses (group_id, status)`).catch(() => {});

      await pool.query(`
        CREATE TABLE IF NOT EXISTS pulse_responses (
          id SERIAL PRIMARY KEY,
          pulse_id INTEGER NOT NULL REFERENCES pulses(id) ON DELETE CASCADE,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          status VARCHAR(8) NOT NULL,
          source VARCHAR(12) NOT NULL DEFAULT 'manual',
          responded_at TIMESTAMPTZ DEFAULT NOW(),
          UNIQUE (pulse_id, user_id)
        )
      `);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_pulse_responses_pulse ON pulse_responses (pulse_id)`).catch(() => {});
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_pulse_responses_user ON pulse_responses (user_id)`).catch(() => {});

      console.log('PostgreSQL schema initialized');
    } catch (err) {
      console.error('Failed to initialize PostgreSQL schema:', err);
    }
  };

  initPostgres();
}

module.exports = pool;
