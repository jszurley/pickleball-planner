const pool = require('../config/db');

const Reservation = {
  async create(eventId, userId, guestCount = 0) {
    const guests = parseInt(guestCount) || 0;
    if (guests < 0 || guests > 3) {
      throw new Error('Guest count must be between 0 and 3');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Check current reservation count and max spots
      const eventResult = await client.query(
        `SELECT e.max_spots,
                COALESCE((SELECT SUM(1 + COALESCE(r.guest_count, 0)) FROM reservations r WHERE r.event_id = e.id), 0) as current_count
         FROM events e
         WHERE e.id = $1
         FOR UPDATE`,
        [eventId]
      );

      if (eventResult.rows.length === 0) {
        throw new Error('Event not found');
      }

      const { max_spots, current_count } = eventResult.rows[0];

      if (parseInt(current_count) + 1 + guests > max_spots) {
        throw new Error('Event is full');
      }

      // Check if user already has a reservation
      const existingResult = await client.query(
        'SELECT 1 FROM reservations WHERE event_id = $1 AND user_id = $2',
        [eventId, userId]
      );

      if (existingResult.rows.length > 0) {
        throw new Error('Already reserved');
      }

      // Create reservation
      const result = await client.query(
        `INSERT INTO reservations (event_id, user_id, guest_count)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [eventId, userId, guests]
      );

      await client.query('COMMIT');
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  async updateGuestCount(eventId, userId, guestCount) {
    const guests = parseInt(guestCount) || 0;
    if (guests < 0 || guests > 3) {
      throw new Error('Guest count must be between 0 and 3');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const result = await client.query(
        `SELECT e.max_spots,
                COALESCE((SELECT SUM(1 + COALESCE(r.guest_count, 0)) FROM reservations r WHERE r.event_id = e.id), 0) as current_count,
                COALESCE((SELECT r.guest_count FROM reservations r WHERE r.event_id = e.id AND r.user_id = $2), 0) as my_guest_count
         FROM events e
         WHERE e.id = $1
         FOR UPDATE`,
        [eventId, userId]
      );

      if (result.rows.length === 0) {
        throw new Error('Event not found');
      }

      const { max_spots, current_count, my_guest_count } = result.rows[0];
      const newTotal = parseInt(current_count) - parseInt(my_guest_count) + guests;

      if (newTotal > max_spots) {
        throw new Error('Not enough spots for that many guests');
      }

      const updateResult = await client.query(
        `UPDATE reservations SET guest_count = $3
         WHERE event_id = $1 AND user_id = $2
         RETURNING *`,
        [eventId, userId, guests]
      );

      if (updateResult.rows.length === 0) {
        throw new Error('Reservation not found');
      }

      await client.query('COMMIT');
      return updateResult.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  async delete(eventId, userId) {
    const result = await pool.query(
      'DELETE FROM reservations WHERE event_id = $1 AND user_id = $2 RETURNING *',
      [eventId, userId]
    );
    return result.rows[0];
  },

  async findByEvent(eventId) {
    const result = await pool.query(
      `SELECT r.*, u.name as user_name, u.email as user_email
       FROM reservations r
       INNER JOIN users u ON r.user_id = u.id
       WHERE r.event_id = $1
       ORDER BY r.created_at`,
      [eventId]
    );
    return result.rows;
  },

  async findByUser(userId) {
    const result = await pool.query(
      `SELECT r.*, e.title as event_title, e.event_date, e.start_time, e.end_time
       FROM reservations r
       INNER JOIN events e ON r.event_id = e.id
       WHERE r.user_id = $1
       ORDER BY e.event_date, e.start_time`,
      [userId]
    );
    return result.rows;
  },

  async exists(eventId, userId) {
    const result = await pool.query(
      'SELECT 1 FROM reservations WHERE event_id = $1 AND user_id = $2',
      [eventId, userId]
    );
    return result.rows.length > 0;
  },

  async findByEventAndUser(eventId, userId) {
    const result = await pool.query(
      'SELECT * FROM reservations WHERE event_id = $1 AND user_id = $2',
      [eventId, userId]
    );
    return result.rows[0] || null;
  }
};

module.exports = Reservation;
