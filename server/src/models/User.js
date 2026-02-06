const pool = require('../config/db');
const bcrypt = require('bcrypt');

const User = {
  async create(email, password, name) {
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const result = await pool.query(
      `INSERT INTO users (email, password_hash, name, role)
       VALUES ($1, $2, $3, 'pending')
       RETURNING id, email, name, role, created_at`,
      [email, passwordHash, name]
    );

    return result.rows[0];
  },

  async findByEmail(email) {
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    return result.rows[0];
  },

  async findById(id) {
    const result = await pool.query(
      'SELECT id, email, name, role, created_at, updated_at FROM users WHERE id = $1',
      [id]
    );
    return result.rows[0];
  },

  async findAll() {
    const result = await pool.query(
      `SELECT id, email, name, role, created_at, updated_at
       FROM users
       WHERE role != 'pending'
       ORDER BY name`
    );
    return result.rows;
  },

  async findPending() {
    const result = await pool.query(
      `SELECT id, email, name, role, created_at
       FROM users
       WHERE role = 'pending'
       ORDER BY created_at DESC`
    );
    return result.rows;
  },

  async updateRole(id, role) {
    const result = await pool.query(
      `UPDATE users SET role = $1 WHERE id = $2
       RETURNING id, email, name, role`,
      [role, id]
    );
    return result.rows[0];
  },

  async delete(id) {
    await pool.query('DELETE FROM users WHERE id = $1', [id]);
  },

  async comparePassword(password, hash) {
    return bcrypt.compare(password, hash);
  },

  async getGroups(userId) {
    const result = await pool.query(
      `SELECT g.id, g.name, g.description, ug.joined_at
       FROM groups g
       INNER JOIN user_groups ug ON g.id = ug.group_id
       WHERE ug.user_id = $1
       ORDER BY g.name`,
      [userId]
    );
    return result.rows;
  },

  async setGroups(userId, groupIds) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Remove existing group assignments
      await client.query(
        'DELETE FROM user_groups WHERE user_id = $1',
        [userId]
      );

      // Add new group assignments
      if (groupIds && groupIds.length > 0) {
        const values = groupIds.map((groupId, i) => `($1, $${i + 2})`).join(', ');
        await client.query(
          `INSERT INTO user_groups (user_id, group_id) VALUES ${values}`,
          [userId, ...groupIds]
        );
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  async isInGroup(userId, groupId) {
    const result = await pool.query(
      'SELECT 1 FROM user_groups WHERE user_id = $1 AND group_id = $2',
      [userId, groupId]
    );
    return result.rows.length > 0;
  }
};

module.exports = User;
