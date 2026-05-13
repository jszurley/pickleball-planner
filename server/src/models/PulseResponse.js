const pool = require('../config/db');

const PulseResponse = {
  async upsert(pulseId, userId, status, source = 'manual') {
    const result = await pool.query(
      `INSERT INTO pulse_responses (pulse_id, user_id, status, source)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (pulse_id, user_id)
       DO UPDATE SET status = EXCLUDED.status, source = EXCLUDED.source, responded_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [pulseId, userId, status, source]
    );
    return result.rows[0];
  },

  async listByPulse(pulseId) {
    const result = await pool.query(
      `SELECT r.id, r.pulse_id, r.user_id, r.status, r.source, r.responded_at,
              u.name AS user_name, u.email AS user_email
       FROM pulse_responses r
       JOIN users u ON r.user_id = u.id
       WHERE r.pulse_id = $1
       ORDER BY r.responded_at`,
      [pulseId]
    );
    return result.rows;
  },

  async countIn(pulseId) {
    const result = await pool.query(
      `SELECT COUNT(*)::int AS n FROM pulse_responses
       WHERE pulse_id = $1 AND status = 'in'`,
      [pulseId]
    );
    return result.rows[0].n;
  },

  // When a user enters away mode, flip their response on any active pulses to "out"
  async autoMarkOutForUser(userId) {
    const result = await pool.query(
      `INSERT INTO pulse_responses (pulse_id, user_id, status, source)
       SELECT p.id, $1, 'out', 'auto_away'
       FROM pulses p
       WHERE p.status = 'active'
       ON CONFLICT (pulse_id, user_id)
       DO UPDATE SET status = 'out', source = 'auto_away', responded_at = CURRENT_TIMESTAMP
       RETURNING pulse_id`,
      [userId]
    );
    return result.rowCount;
  },

  // When a user clears away mode, remove their auto_away rows so they can respond fresh
  async removeAutoAwayForUser(userId) {
    const result = await pool.query(
      `DELETE FROM pulse_responses
       WHERE user_id = $1 AND source = 'auto_away'
       AND pulse_id IN (SELECT id FROM pulses WHERE status = 'active')`,
      [userId]
    );
    return result.rowCount;
  }
};

module.exports = PulseResponse;
