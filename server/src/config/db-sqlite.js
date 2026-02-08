const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../../data/pickleball.db');

let db = null;
let SQL = null;

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

async function initDB() {
  if (db) return db;

  SQL = await initSqlJs();

  // Load existing database or create new one
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
    initSchema();
  }

  console.log('Connected to SQLite database');
  return db;
}

function saveDB() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  }
}

function initSchema() {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      phone TEXT,
      role TEXT NOT NULL DEFAULT 'pending' CHECK (role IN ('pending', 'member', 'admin')),
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Add phone column if it doesn't exist (migration for existing databases)
  try {
    db.run('ALTER TABLE users ADD COLUMN phone TEXT');
  } catch (e) {
    // Column may already exist
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS user_groups (
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE,
      joined_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, group_id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS locations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      address TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE NOT NULL,
      creator_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      event_date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      max_spots INTEGER NOT NULL CHECK (max_spots > 0),
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS reservations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER REFERENCES events(id) ON DELETE CASCADE NOT NULL,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE (event_id, user_id)
    )
  `);

  // Create indexes
  db.run('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)');
  db.run('CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)');
  db.run('CREATE INDEX IF NOT EXISTS idx_user_groups_user_id ON user_groups(user_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_user_groups_group_id ON user_groups(group_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_events_group_id ON events(group_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_events_event_date ON events(event_date)');
  db.run('CREATE INDEX IF NOT EXISTS idx_reservations_event_id ON reservations(event_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_reservations_user_id ON reservations(user_id)');

  saveDB();
}

// PostgreSQL-compatible query interface
const pool = {
  async query(sql, params = []) {
    await initDB();

    // Convert PostgreSQL parameter placeholders ($1, $2, ...) to SQLite (?, ?, ...)
    // PostgreSQL allows $1 to appear multiple times (same param), but SQLite needs
    // each ? to have its own parameter in order. Build new params array accordingly.
    let convertedSql = sql;
    const newParams = [];

    // Find all $N placeholders and their positions
    const regex = /\$(\d+)/g;
    let match;
    const placeholders = [];
    while ((match = regex.exec(sql)) !== null) {
      placeholders.push({ index: parseInt(match[1]) - 1, position: match.index });
    }

    // Build new params array in order of appearance
    for (const ph of placeholders) {
      if (ph.index < params.length) {
        newParams.push(params[ph.index]);
      }
    }

    // Replace all $N with ?
    convertedSql = sql.replace(/\$\d+/g, '?');

    // Use new params if we found placeholders, otherwise use original
    const finalParams = placeholders.length > 0 ? newParams : params;

    // Convert PostgreSQL-specific syntax to SQLite
    convertedSql = convertedSql
      .replace(/RETURNING \*/gi, '')
      .replace(/RETURNING [^;]*/gi, '')
      .replace(/SERIAL PRIMARY KEY/gi, 'INTEGER PRIMARY KEY AUTOINCREMENT')
      .replace(/CURRENT_TIMESTAMP/gi, "datetime('now')")
      .replace(/CURRENT_DATE/gi, "date('now')")
      .replace(/ON CONFLICT \(email\) DO UPDATE SET[^;]*/gi, 'ON CONFLICT(email) DO UPDATE SET password_hash = excluded.password_hash, role = excluded.role')
      .replace(/ON CONFLICT DO NOTHING/gi, 'ON CONFLICT DO NOTHING')
      .replace(/FOR UPDATE/gi, '');

    const isSelect = convertedSql.trim().toUpperCase().startsWith('SELECT');
    const isInsert = convertedSql.trim().toUpperCase().startsWith('INSERT');
    const isUpdate = convertedSql.trim().toUpperCase().startsWith('UPDATE');
    const isDelete = convertedSql.trim().toUpperCase().startsWith('DELETE');

    try {
      if (isSelect) {
        const stmt = db.prepare(convertedSql);
        stmt.bind(finalParams);
        const rows = [];
        while (stmt.step()) {
          rows.push(stmt.getAsObject());
        }
        stmt.free();
        return { rows };
      } else {
        db.run(convertedSql, finalParams);
        saveDB();

        if (isInsert && sql.toUpperCase().includes('RETURNING')) {
          // Get the last inserted row by finding max id
          const tableName = sql.match(/INSERT INTO (\w+)/i)?.[1];
          if (tableName) {
            // Get the max id which should be the just-inserted row
            const maxIdStmt = db.prepare(`SELECT MAX(id) as id FROM ${tableName}`);
            if (maxIdStmt.step()) {
              const lastId = maxIdStmt.getAsObject().id;
              maxIdStmt.free();

              if (lastId) {
                const rowStmt = db.prepare(`SELECT * FROM ${tableName} WHERE id = ?`);
                rowStmt.bind([lastId]);
                if (rowStmt.step()) {
                  const row = rowStmt.getAsObject();
                  rowStmt.free();
                  return { rows: [row] };
                }
                rowStmt.free();
              }
            } else {
              maxIdStmt.free();
            }
          }
        }

        if ((isUpdate || isDelete) && sql.includes('RETURNING')) {
          // For UPDATE/DELETE with RETURNING, we need to handle differently
          // This is a simplified version - just return empty for now
          return { rows: [{}] };
        }

        return { rows: [] };
      }
    } catch (error) {
      console.error('SQL Error:', error.message);
      console.error('SQL:', convertedSql);
      console.error('Params:', params);
      throw error;
    }
  },

  async connect() {
    await initDB();
    const self = this;
    return {
      async query(sql, params = []) {
        // Handle transaction commands
        const upperSql = sql.trim().toUpperCase();
        if (upperSql === 'BEGIN' || upperSql === 'BEGIN TRANSACTION') {
          return { rows: [] };
        }
        if (upperSql === 'COMMIT') {
          saveDB();
          return { rows: [] };
        }
        if (upperSql === 'ROLLBACK') {
          return { rows: [] };
        }
        return self.query(sql, params);
      },
      release: () => {}
    };
  }
};

module.exports = pool;
