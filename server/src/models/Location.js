const pool = require('../config/db');

const Location = {
  async create(name, address) {
    const result = await pool.query(
      `INSERT INTO locations (name, address)
       VALUES ($1, $2)
       RETURNING *`,
      [name, address || null]
    );
    return result.rows[0];
  },

  async findById(id) {
    const result = await pool.query(
      'SELECT * FROM locations WHERE id = $1',
      [id]
    );
    return result.rows[0];
  },

  async findAll() {
    const result = await pool.query(
      'SELECT * FROM locations ORDER BY name'
    );
    return result.rows;
  },

  async update(id, name, address) {
    const result = await pool.query(
      `UPDATE locations SET name = $1, address = $2
       WHERE id = $3
       RETURNING *`,
      [name, address || null, id]
    );
    return result.rows[0];
  },

  async delete(id) {
    await pool.query('DELETE FROM locations WHERE id = $1', [id]);
  }
};

module.exports = Location;
