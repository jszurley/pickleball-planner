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
  });

  pool.on('connect', () => {
    console.log('Connected to PostgreSQL database');
  });

  pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1);
  });
}

module.exports = pool;
