const pool = require('../config/db');

const GroupRequest = {
  async create(userId, groupId) {
    const result = await pool.query(
      `INSERT INTO group_requests (user_id, group_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, group_id) DO NOTHING
       RETURNING *`,
      [userId, groupId]
    );
    return result.rows[0];
  },

  async delete(userId, groupId) {
    const result = await pool.query(
      'DELETE FROM group_requests WHERE user_id = $1 AND group_id = $2 RETURNING *',
      [userId, groupId]
    );
    return result.rows[0];
  },

  async findByUser(userId) {
    const result = await pool.query(
      `SELECT gr.*, g.name as group_name
       FROM group_requests gr
       INNER JOIN groups g ON gr.group_id = g.id
       WHERE gr.user_id = $1
       ORDER BY gr.created_at`,
      [userId]
    );
    return result.rows;
  },

  async findRequestedGroupIds(userId) {
    const result = await pool.query(
      'SELECT group_id FROM group_requests WHERE user_id = $1',
      [userId]
    );
    return result.rows.map(r => r.group_id);
  },

  async deleteAllForUser(userId) {
    await pool.query('DELETE FROM group_requests WHERE user_id = $1', [userId]);
  },

  async findByGroup(groupId) {
    const result = await pool.query(
      `SELECT gr.*, u.name as user_name, u.email as user_email
       FROM group_requests gr
       INNER JOIN users u ON gr.user_id = u.id
       WHERE gr.group_id = $1 AND u.role != 'pending'
       ORDER BY gr.created_at`,
      [groupId]
    );
    return result.rows;
  },

  async countByGroup() {
    const result = await pool.query(
      `SELECT gr.group_id, COUNT(*)::int as request_count
       FROM group_requests gr
       INNER JOIN users u ON gr.user_id = u.id
       WHERE u.role != 'pending'
       GROUP BY gr.group_id`
    );
    return result.rows;
  }
};

module.exports = GroupRequest;
