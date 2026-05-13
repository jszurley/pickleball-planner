const pool = require('../config/db');

const Pulse = {
  // Create a new active pulse. Throws on unique-violation (one active per group).
  async create(groupId, creatorId, locationId, pulseDate, startTime, endTime) {
    const result = await pool.query(
      `INSERT INTO pulses (group_id, creator_id, location_id, pulse_date, start_time, end_time)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [groupId, creatorId, locationId || null, pulseDate, startTime, endTime]
    );
    return result.rows[0];
  },

  async findById(id) {
    const result = await pool.query(
      `SELECT p.*, l.name AS location_name, u.name AS creator_name, g.name AS group_name, g.min_players
       FROM pulses p
       LEFT JOIN locations l ON p.location_id = l.id
       LEFT JOIN users u ON p.creator_id = u.id
       LEFT JOIN groups g ON p.group_id = g.id
       WHERE p.id = $1`,
      [id]
    );
    return result.rows[0];
  },

  async getActiveForGroup(groupId) {
    const result = await pool.query(
      `SELECT p.*, l.name AS location_name, u.name AS creator_name, g.name AS group_name, g.min_players
       FROM pulses p
       LEFT JOIN locations l ON p.location_id = l.id
       LEFT JOIN users u ON p.creator_id = u.id
       LEFT JOIN groups g ON p.group_id = g.id
       WHERE p.group_id = $1 AND p.status = 'active'
       LIMIT 1`,
      [groupId]
    );
    return result.rows[0] || null;
  },

  async close(id) {
    const result = await pool.query(
      `UPDATE pulses SET status = 'closed', archived_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND status = 'active'
       RETURNING *`,
      [id]
    );
    return result.rows[0];
  },

  async archiveExpired() {
    // Cutoff: any pulse whose start time is more than 2 hours in the past.
    // Computed in JS to stay portable across Postgres + SQLite.
    const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const cutoffDate = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}-${String(cutoff.getDate()).padStart(2, '0')}`;
    const cutoffTime = `${String(cutoff.getHours()).padStart(2, '0')}:${String(cutoff.getMinutes()).padStart(2, '0')}`;
    // (pulse_date < cutoffDate) OR (pulse_date = cutoffDate AND start_time < cutoffTime)
    const result = await pool.query(
      `UPDATE pulses
       SET status = 'archived', archived_at = CURRENT_TIMESTAMP
       WHERE status = 'active'
         AND (pulse_date < $1 OR (pulse_date = $1 AND start_time < $2))`,
      [cutoffDate, cutoffTime]
    );
    return result.rowCount || 0;
  },

  // Smart-default lookup: user's most common (location, start_time) from past "in" responses
  async getSmartDefaults(userId) {
    const result = await pool.query(
      `SELECT p.location_id, p.start_time, p.end_time, COUNT(*) AS n
       FROM pulses p
       JOIN pulse_responses r ON r.pulse_id = p.id
       WHERE r.user_id = $1 AND r.status = 'in'
       GROUP BY p.location_id, p.start_time, p.end_time
       ORDER BY n DESC
       LIMIT 1`,
      [userId]
    );
    return result.rows[0] || null;
  }
};

module.exports = Pulse;
