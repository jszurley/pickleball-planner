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
  },

  // Clone an event to a specific date
  async clone(eventId, newDate, creatorId) {
    const original = await this.findById(eventId);
    if (!original) return null;

    return this.create(
      original.group_id,
      creatorId,
      original.location_id,
      original.title,
      newDate,
      original.start_time,
      original.end_time,
      original.max_spots
    );
  },

  // Helper to format date as YYYY-MM-DD without timezone conversion
  formatDateString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  // Helper to parse date string as local date
  parseLocalDate(dateStr) {
    const [year, month, day] = dateStr.split('-');
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  },

  // Create recurring events
  async createRecurring(groupId, creatorId, locationId, title, startDate, endDate, startTime, endTime, maxSpots, frequency, daysOfWeek = null) {
    const events = [];
    // Parse dates as local to avoid timezone issues
    const start = this.parseLocalDate(startDate);
    const end = this.parseLocalDate(endDate);

    // For daily and weekly with daysOfWeek, iterate day by day and check if day matches
    if ((frequency === 'daily' || frequency === 'weekly') && daysOfWeek && daysOfWeek.length > 0) {
      let currentDate = new Date(start);
      while (currentDate <= end) {
        const dayOfWeek = currentDate.getDay(); // 0 = Sunday, 6 = Saturday
        if (daysOfWeek.includes(dayOfWeek)) {
          const dateStr = this.formatDateString(currentDate);
          const event = await this.create(
            groupId,
            creatorId,
            locationId,
            title,
            dateStr,
            startTime,
            endTime,
            maxSpots
          );
          events.push(event);
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }
      return events;
    }

    // Original logic for biweekly/monthly or when no daysOfWeek specified
    let intervalDays;
    switch (frequency) {
      case 'daily':
        intervalDays = 1;
        break;
      case 'weekly':
        intervalDays = 7;
        break;
      case 'biweekly':
        intervalDays = 14;
        break;
      case 'monthly':
        intervalDays = 30; // Approximate
        break;
      default:
        intervalDays = 7;
    }

    let currentDate = new Date(start);
    while (currentDate <= end) {
      const dateStr = this.formatDateString(currentDate);
      const event = await this.create(
        groupId,
        creatorId,
        locationId,
        title,
        dateStr,
        startTime,
        endTime,
        maxSpots
      );
      events.push(event);

      // Move to next occurrence
      if (frequency === 'monthly') {
        currentDate.setMonth(currentDate.getMonth() + 1);
      } else {
        currentDate.setDate(currentDate.getDate() + intervalDays);
      }
    }

    return events;
  }
};

module.exports = Event;
