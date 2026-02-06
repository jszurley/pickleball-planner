require('dotenv').config();

const bcrypt = require('bcrypt');
const pool = require('../config/db');

async function seed() {
  console.log('Seeding database...');

  try {
    // Create admin user
    const adminPassword = '103piCKle668!';
    const passwordHash = await bcrypt.hash(adminPassword, 10);

    // Check if admin already exists
    const existingAdmin = await pool.query(
      'SELECT id FROM users WHERE email = ?',
      ['jszurls@gmail.com']
    );

    if (existingAdmin.rows.length === 0) {
      await pool.query(
        `INSERT INTO users (email, password_hash, name, role)
         VALUES (?, ?, ?, 'admin')`,
        ['jszurls@gmail.com', passwordHash, 'Admin']
      );
      console.log('Admin user created: jszurls@gmail.com');
    } else {
      console.log('Admin user already exists: jszurls@gmail.com');
    }

    // Create sample groups
    const groups = [
      { name: 'Morning Players', description: 'Early morning pickleball sessions' },
      { name: 'Weekend Warriors', description: 'Weekend games for all skill levels' },
      { name: 'Competitive League', description: 'For players looking for competitive matches' }
    ];

    for (const group of groups) {
      const existing = await pool.query(
        'SELECT id FROM groups WHERE name = ?',
        [group.name]
      );
      if (existing.rows.length === 0) {
        await pool.query(
          'INSERT INTO groups (name, description) VALUES (?, ?)',
          [group.name, group.description]
        );
      }
    }
    console.log('Sample groups created');

    // Create sample locations
    const locations = [
      { name: 'Community Recreation Center', address: '123 Main Street, Anytown, USA' },
      { name: 'City Park Courts', address: '456 Park Avenue, Anytown, USA' },
      { name: 'YMCA Indoor Courts', address: '789 Fitness Lane, Anytown, USA' }
    ];

    for (const location of locations) {
      const existing = await pool.query(
        'SELECT id FROM locations WHERE name = ?',
        [location.name]
      );
      if (existing.rows.length === 0) {
        await pool.query(
          'INSERT INTO locations (name, address) VALUES (?, ?)',
          [location.name, location.address]
        );
      }
    }
    console.log('Sample locations created');

    console.log('\nSeed completed successfully!');
    console.log('Admin login: jszurls@gmail.com / 103piCKle668!');

    process.exit(0);
  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  }
}

seed();
