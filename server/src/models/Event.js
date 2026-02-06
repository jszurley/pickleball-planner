const pool = require('../config/db');

const Event = {
  async create(groupId, creatorId, locationId, title, eventDate, startTime, endTime, maxSpots) {
    const result = await pool.query(
      `INSERT INTO events (group_id, creator_id, location_id, title, event_date, start_time, end_time, max_spots)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [groupId, creatorId, locationId || null, title, eventDate, startTime, endTime, maxSpots]
    );
    return result.rows[0];
  },

  async findById(id) {
    const result = await pool.query(
      `SELECT e.*,
              l.name as location_name, l.address as location_address,
              u.name as creator_name, u.email as creator_email,
              g.name as group_name,
              (SELECT COUNT(*) FROM reservations r WHERE r.event_id = e.id) as reservation_count
       FROM events e
       LEFT JOIN locations l ON e.location_id = l.id
       LEFT JOIN users u ON e.creator_id = u.id
       LEFT JOIN groups g ON e.group_id = g.id
       WHERE e.id = $1`,
      [id]
    );
    return result.rows[0];
  },

  async findByGroup(groupId) {
    const result = await pool.query(
      `SELECT e.*,
              l.name as location_name, l.address as location_address,
              u.name as creator_name,
              (SELECT COUNT(*) FROM reservations r WHERE r.event_id = e.id) as reservation_count
       FROM events e
       LEFT JOIN locations l ON e.location_id = l.id
       LEFT JOIN users u ON e.creator_id = u.id
       WHERE e.group_id = $1
       AND e.event_date >= CURRENT_DATE
       ORDER BY e.event_date, e.start_time`,
      [groupId]
    );
    return result.rows;
  },

  async findByGroupWithPast(groupId) {
    const result = await pool.query(
      `SELECT e.*,
              l.name as location_name, l.address as location_address,
              u.name as creator_name,
              (SELECT COUNT(*) FROM reservations r WHERE r.event_id = e.id) as reservation_count
       FROM events e
       LEFT JOIN locations l ON e.location_id = l.id
       LEFT JOIN users u ON e.creator_id = u.id
       WHERE e.group_id = $1
       ORDER BY e.event_date DESC, e.start_time DESC`,
      [groupId]
    );
    return result.rows;
  },

  async findUpcomingByUser(userId) {
    const result = await pool.query(
      `SELECT e.*,
              l.name as location_name, l.address as location_address,
              u.name as creator_name,
              g.name as group_name,
              (SELECT COUNT(*) FROM reservations r WHERE r.event_id = e.id) as reservation_count,
              EXISTS(SELECT 1 FROM reservations r WHERE r.event_id = e.id AND r.user_id = $1) as is_reserved
       FROM events e
       INNER JOIN user_groups ug ON e.group_id = ug.group_id AND ug.user_id = $1
       LEFT JOIN locations l ON e.location_id = l.id
       LEFT JOIN users u ON e.creator_id = u.id
       LEFT JOIN groups g ON e.group_id = g.id
       WHERE e.event_date >= CURRENT_DATE
       ORDER BY e.event_date, e.start_time`,
      [userId]
    );
    return result.rows;
  },

  async findReservedByUser(userId) {
    const result = await pool.query(
      `SELECT e.*,
              l.name as location_name, l.address as location_address,
              u.name as creator_name,
              g.name as group_name,
              (SELECT COUNT(*) FROM reservations r WHERE r.event_id = e.id) as reservation_count,
              true as is_reserved
       FROM events e
       INNER JOIN reservations res ON e.id = res.event_id AND res.user_id = $1
       LEFT JOIN locations l ON e.location_id = l.id
       LEFT JOIN users u ON e.creator_id = u.id
       LEFT JOIN groups g ON e.group_id = g.id
       WHERE e.event_date >= CURRENT_DATE
       ORDER BY e.event_date, e.start_time`,
      [userId]
    );
    return result.rows;
  },

  async update(id, title, eventDate, startTime, endTime, locationId, maxSpots) {
    const result = await pool.query(
      `UPDATE events
       SET title = $1, event_date = $2, start_time = $3, end_time = $4, location_id = $5, max_spots = $6
       WHERE id = $7
       RETURNING *`,
      [title, eventDate, startTime, endTime, locationId || null, maxSpots, id]
    );
    return result.rows[0];
  },

  async delete(id) {
    await pool.query('DELETE FROM events WHERE id = $1', [id]);
  },

  async findAll() {
    const result = await pool.query(
      `SELECT e.*,
              l.name as location_name, l.address as location_address,
              u.name as creator_name,
              g.name as group_name,
              (SELECT COUNT(*) FROM reservations r WHERE r.event_id = e.id) as reservation_count
       FROM events e
       LEFT JOIN locations l ON e.location_id = l.id
       LEFT JOIN users u ON e.creator_id = u.id
       LEFT JOIN groups g ON e.group_id = g.id
       ORDER BY e.event_date DESC, e.start_time DESC`
    );
    return result.rows;
  }
};

module.exports = Event;
