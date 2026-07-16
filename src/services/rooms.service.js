const { Query } = require("pg");

const roomsService = {
  // Ensure rooms table exists
  async ensure(pool) {
    const client = await pool.connect();
    try {
      const tableExists = await client.query(`
        SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'rooms')
      `);
      if (!tableExists.rows[0].exists) {
        await client.query(`
          CREATE TABLE rooms (
            id SERIAL PRIMARY KEY,
            room_number VARCHAR(50) NOT NULL,
            block_id INTEGER,
            floor_number INTEGER,
            room_type VARCHAR(100) NOT NULL DEFAULT 'Classroom',
            total_capacity INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
          )
        `);
        await client.query(
          `CREATE INDEX idx_rooms_room_number ON rooms(room_number)`,
        );
        await client.query(
          `CREATE INDEX idx_rooms_floor_number ON rooms(floor_number)`,
        );
        await client.query(
          `CREATE INDEX idx_rooms_block_id ON rooms(block_id)`,
        );
      } else {
        await client.query(
          'ALTER TABLE rooms ADD COLUMN IF NOT EXISTS block_id INTEGER',
        );
        await client.query(
          'CREATE INDEX IF NOT EXISTS idx_rooms_block_id ON rooms(block_id)',
        );
      }
    } finally {
      client.release();
    }
  },

  async getAll(pool) {
    const client = await pool.connect();
    try {
      const result = await client.query(
        "SELECT * FROM rooms ORDER BY room_number ASC",
      );
      return result.rows;
    } finally {
      client.release();
    }
  },

  async getById(pool, id) {
    const client = await pool.connect();
    try {
      const result = await client.query("SELECT * FROM rooms WHERE id = $1", [
        id,
      ]);
      return result.rows[0] || null;
    } finally {
      client.release();
    }
  },

  async create(pool, data) {
    const { room_number, block_id, floor_number, room_type, total_capacity } = data;
    const client = await pool.connect();
    try {
      const result = await client.query(
        `INSERT INTO rooms (room_number, block_id, floor_number, room_type, total_capacity)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [room_number, block_id || null, floor_number, room_type, total_capacity],
      );
      return result.rows[0];
    } finally {
      client.release();
    }
  },

  async update(pool, id, data) {
    const allowed = [
      "room_number",
      "block_id",
      "floor_number",
      "room_type",
      "total_capacity",
    ];
    const fields = [];
    const values = [];
    let paramCount = 1;

    for (const [key, val] of Object.entries(data)) {
      if (allowed.includes(key)) {
        fields.push(`${key} = $${paramCount++}`);
        values.push(val);
      }
    }

    if (fields.length === 0) return await this.getById(pool, id);

    fields.push(`updated_at = $${paramCount++}`);
    values.push(new Date());
    values.push(id);

    const client = await pool.connect();
    try {
      const result = await client.query(
        `UPDATE rooms SET ${fields.join(", ")} WHERE id = $${paramCount} RETURNING *`,
        values,
      );
      return result.rows[0] || null;
    } finally {
      client.release();
    }
  },

  async delete(pool, id) {
    const client = await pool.connect();
    try {
      await client.query("DELETE FROM rooms WHERE id = $1", [id]);
      return true;
    } finally {
      client.release();
    }
  },
};

module.exports = roomsService;
