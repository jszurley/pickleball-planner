const pool = require('../config/db');

const Group = {
  async create(name, description) {
    const result = await pool.query(
      `INSERT INTO groups (name, description)
       VALUES ($1, $2)
       RETURNING *`,
      [name, description || null]
    );
    return result.rows[0];
  },

  async findById(id) {
    const result = await pool.query(
      'SELECT * FROM groups WHERE id = $1',
      [id]
    );
    return result.rows[0];
  },

  async findAll() {
    const result = await pool.query(
      'SELECT * FROM groups ORDER BY name'
    );
    return result.rows;
  },

  async findByUser(userId) {
    const result = await pool.query(
      `SELECT g.*
       FROM groups g
       INNER JOIN user_groups ug ON g.id = ug.group_id
       WHERE ug.user_id = $1
       ORDER BY g.name`,
      [userId]
    );
    return result.rows;
  },

  async update(id, name, description) {
    const result = await pool.query(
      `UPDATE groups SET name = $1, description = $2
       WHERE id = $3
       RETURNING *`,
      [name, description || null, id]
    );
    return result.rows[0];
  },

  async delete(id) {
    await pool.query('DELETE FROM groups WHERE id = $1', [id]);
  },

  async getLocations(groupId) {
    const result = await pool.query(
      `SELECT l.id, l.name, l.address
       FROM locations l
       INNER JOIN group_locations gl ON l.id = gl.location_id
       WHERE gl.group_id = $1
       ORDER BY l.name`,
      [groupId]
    );
    return result.rows;
  },

  async setLocations(groupId, locationIds) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        'DELETE FROM group_locations WHERE group_id = $1',
        [groupId]
      );

      if (locationIds && locationIds.length > 0) {
        const values = locationIds.map((locId, i) => `($1, $${i + 2})`).join(', ');
        await client.query(
          `INSERT INTO group_locations (group_id, location_id) VALUES ${values}`,
          [groupId, ...locationIds]
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

  async getMembers(groupId) {
    const result = await pool.query(
      `SELECT u.id, u.email, u.name, u.role, ug.joined_at
       FROM users u
       INNER JOIN user_groups ug ON u.id = ug.user_id
       WHERE ug.group_id = $1
       ORDER BY u.name`,
      [groupId]
    );
    return result.rows;
  }
};

module.exports = Group;
