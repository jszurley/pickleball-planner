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
      `SELECT id, email, name, phone, role, level_of_play, dupr_rating, certified_rating,
              default_group_id, default_location_id,
              usual_morning_start, usual_evening_start, usual_duration_min,
              away_start_date, away_end_date,
              (push_subscription IS NOT NULL) AS has_push_subscription,
              created_at, updated_at
       FROM users WHERE id = $1`,
      [id]
    );
    return result.rows[0];
  },

  async updatePreferences(id, { default_group_id, default_location_id, usual_morning_start, usual_evening_start, usual_duration_min }) {
    const result = await pool.query(
      `UPDATE users
       SET default_group_id = $1,
           default_location_id = $2,
           usual_morning_start = COALESCE($3, usual_morning_start),
           usual_evening_start = COALESCE($4, usual_evening_start),
           usual_duration_min = COALESCE($5, usual_duration_min),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $6
       RETURNING *`,
      [default_group_id || null, default_location_id || null, usual_morning_start || null, usual_evening_start || null, usual_duration_min || null, id]
    );
    return result.rows[0];
  },

  async setAway(id, startDate, endDate) {
    const result = await pool.query(
      `UPDATE users SET away_start_date = $1, away_end_date = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3 RETURNING away_start_date, away_end_date`,
      [startDate, endDate, id]
    );
    return result.rows[0];
  },

  async clearAway(id) {
    await pool.query(
      `UPDATE users SET away_start_date = NULL, away_end_date = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [id]
    );
  },

  async setPushSubscription(id, subscription) {
    await pool.query(
      `UPDATE users SET push_subscription = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [subscription ? JSON.stringify(subscription) : null, id]
    );
  },

  async updateProfile(id, { name, email, phone, level_of_play, dupr_rating, certified_rating }) {
    const result = await pool.query(
      `UPDATE users
       SET name = $1, email = $2, phone = $3, level_of_play = $4, dupr_rating = $5, certified_rating = $6, updated_at = CURRENT_TIMESTAMP
       WHERE id = $7
       RETURNING id, email, name, phone, role, level_of_play, dupr_rating, certified_rating, created_at, updated_at`,
      [name, email, phone || null, level_of_play || null, dupr_rating || null, certified_rating || false, id]
    );
    return result.rows[0];
  },

  async updatePassword(id, newPassword) {
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(newPassword, saltRounds);
    await pool.query(
      'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [passwordHash, id]
    );
  },

  async findAll() {
    const result = await pool.query(
      `SELECT id, email, name, role, level_of_play, dupr_rating, certified_rating, created_at, updated_at
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
