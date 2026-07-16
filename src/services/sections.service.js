const roomsService = require("./rooms.service");
const classroomService = require("./classroom.service");

const sectionsService = {
  // Ensure sections table exists
  async ensure(pool) {
    // Ensure related tables exist first
    await roomsService.ensure(pool);
    await classroomService.ensure(pool);

    const client = await pool.connect();
    try {
      const tableExists = await client.query(`
        SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'sections')
      `);
      if (!tableExists.rows[0].exists) {
        await client.query(`
          CREATE TABLE sections (
            id SERIAL PRIMARY KEY,
            section_name VARCHAR(100) NOT NULL,
            class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE,
            block_id INTEGER REFERENCES school_blocks(id) ON DELETE SET NULL,
            floor_number INTEGER,
            room_id INTEGER REFERENCES rooms(id) ON DELETE SET NULL,
            total_students INTEGER NOT NULL DEFAULT 0,
            monitor_name VARCHAR(255),
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
          )
        `);
        await client.query(
          `CREATE INDEX idx_sections_section_name ON sections(section_name)`,
        );
        await client.query(
          `CREATE INDEX idx_sections_class_id ON sections(class_id)`,
        );
        await client.query(
          `CREATE INDEX idx_sections_block_id ON sections(block_id)`,
        );
        await client.query(
          `CREATE INDEX idx_sections_room_id ON sections(room_id)`,
        );
      }

      const hasSectionName = await client.query(
        "SELECT column_name FROM information_schema.columns WHERE table_name = 'sections' AND column_name = 'section_name'",
      );
      if (!hasSectionName.rows.length) {
        const hasLegacyName = await client.query(
          "SELECT column_name FROM information_schema.columns WHERE table_name = 'sections' AND column_name = 'name'",
        );
        if (hasLegacyName.rows.length) {
          await client.query(
            "ALTER TABLE sections RENAME COLUMN name TO section_name",
          );
        } else {
          await client.query(
            "ALTER TABLE IF EXISTS sections ADD COLUMN section_name VARCHAR(100) NOT NULL DEFAULT 'Section'",
          );
        }
      }

      // Transition class_id foreign key from classes to classrooms
      try {
        await client.query("ALTER TABLE sections DROP CONSTRAINT IF EXISTS sections_class_id_fkey");
      } catch (err) {
        // ignore
      }
      try {
        await client.query("ALTER TABLE sections ADD CONSTRAINT sections_class_id_fkey FOREIGN KEY (class_id) REFERENCES classrooms(id) ON DELETE CASCADE");
      } catch (err) {
        // constraint may already exist, ignore if it exists
      }
      await client.query(
        "ALTER TABLE IF EXISTS sections ADD COLUMN IF NOT EXISTS block_id INTEGER REFERENCES school_blocks(id) ON DELETE SET NULL",
      );
      await client.query(
        "ALTER TABLE IF EXISTS sections ADD COLUMN IF NOT EXISTS floor_number INTEGER",
      );
      await client.query(
        "ALTER TABLE IF EXISTS sections ADD COLUMN IF NOT EXISTS room_id INTEGER REFERENCES rooms(id) ON DELETE SET NULL",
      );
      await client.query(
        "ALTER TABLE IF EXISTS sections ADD COLUMN IF NOT EXISTS total_students INTEGER DEFAULT 0",
      );
      await client.query(
        "ALTER TABLE IF EXISTS sections ADD COLUMN IF NOT EXISTS monitor_name VARCHAR(255)",
      );
      await client.query(
        "ALTER TABLE IF EXISTS sections ADD COLUMN IF NOT EXISTS class_teacher_id UUID",
      );
      await client.query(
        "CREATE INDEX IF NOT EXISTS idx_sections_class_id ON sections(class_id)",
      );
      await client.query(
        "CREATE INDEX IF NOT EXISTS idx_sections_block_id ON sections(block_id)",
      );
      await client.query(
        "CREATE INDEX IF NOT EXISTS idx_sections_room_id ON sections(room_id)",
      );
    } finally {
      client.release();
    }
  },

  async getAll(pool) {
    await this.ensure(pool);
    const client = await pool.connect();
    try {
      try {
        const result = await client.query(`
          SELECT s.*, r.room_number, r.floor_number, c.id AS class_id, c.name AS class_name, 
                 COALESCE(t.full_name, 'Not assigned') as class_teacher_name, t.employee_id as teacher_employee_id
          FROM sections s
          LEFT JOIN rooms r ON s.room_id = r.id
          LEFT JOIN classrooms c ON s.class_id = c.id
          LEFT JOIN teachers t ON s.class_teacher_id = t.id
          ORDER BY s.section_name ASC
        `);
        return result.rows.map(normalizeSectionRow);
      } catch (err) {
        if (err && err.code === "42703") {
          const result = await client.query("SELECT * FROM sections");
          return result.rows.map(normalizeSectionRow);
        }
        throw err;
      }
    } finally {
      client.release();
    }
  },

  async getById(pool, id) {
    await this.ensure(pool);
    const client = await pool.connect();
    try {
      try {
        const result = await client.query(
          `
          SELECT s.*, r.room_number, r.floor_number, c.id AS class_id, c.name AS class_name,
                 COALESCE(t.full_name, 'Not assigned') as class_teacher_name, t.employee_id as teacher_employee_id
          FROM sections s
          LEFT JOIN rooms r ON s.room_id = r.id
          LEFT JOIN classrooms c ON s.class_id = c.id
          LEFT JOIN teachers t ON s.class_teacher_id = t.id
          WHERE s.id = $1
        `,
          [id],
        );
        return result.rows[0] ? normalizeSectionRow(result.rows[0]) : null;
      } catch (err) {
        if (err && err.code === "42703") {
          const result = await client.query(
            "SELECT * FROM sections WHERE id = $1",
            [id],
          );
          return result.rows[0] ? normalizeSectionRow(result.rows[0]) : null;
        }
        throw err;
      }
    } finally {
      client.release();
    }
  },

  async create(pool, data) {
    await this.ensure(pool);
    const {
      section_name,
      class_id,
      block_id,
      floor_number,
      room_id,
      total_students,
      monitor_name,
      class_teacher_id,
    } = data;
    const client = await pool.connect();
    try {
      const columns = [
        "section_name",
        "class_id",
        "block_id",
        "floor_number",
        "room_id",
        "total_students",
        "monitor_name",
        "class_teacher_id",
      ];
      const values = [
        section_name,
        class_id,
        block_id || null,
        floor_number || null,
        room_id || null,
        total_students || 0,
        monitor_name || null,
        class_teacher_id || null,
      ];
      const placeholders = values.map((_, i) => `$${i + 1}`).join(", ");
      const q = `INSERT INTO sections (${columns.join(", ")}) VALUES (${placeholders}) RETURNING *`;
      const result = await client.query(q, values);
      return normalizeSectionRow(result.rows[0]);
    } finally {
      client.release();
    }
  },

  async update(pool, id, data) {
    await this.ensure(pool);
    const allowed = [
      "section_name",
      "class_id",
      "block_id",
      "floor_number",
      "room_id",
      "total_students",
      "monitor_name",
      "class_teacher_id",
    ];
    const fields = [];
    const values = [];
    let paramCount = 1;
    for (const [key, val] of Object.entries(data)) {
      if (!allowed.includes(key)) continue;
      fields.push(`${key} = $${paramCount++}`);
      values.push(val);
    }
    if (fields.length === 0) return await this.getById(pool, id);
    fields.push(`updated_at = $${paramCount++}`);
    values.push(new Date());
    values.push(id);
    const result = await pool.query(
      `UPDATE sections SET ${fields.join(", ")} WHERE id = $${paramCount} RETURNING *`,
      values,
    );
    return result.rows[0] ? normalizeSectionRow(result.rows[0]) : null;
  },

  async delete(pool, id) {
    await this.ensure(pool);
    const client = await pool.connect();
    try {
      await client.query("DELETE FROM sections WHERE id = $1", [id]);
      return true;
    } finally {
      client.release();
    }
  },

  async getByRoomId(pool, roomId) {
    await this.ensure(pool);
    const client = await pool.connect();
    try {
      const result = await client.query(
        `
        SELECT s.*, r.room_number, r.floor_number, c.id AS class_id, c.name AS class_name,
               COALESCE(t.full_name, 'Not assigned') as class_teacher_name, t.employee_id as teacher_employee_id
        FROM sections s
        LEFT JOIN rooms r ON s.room_id = r.id
        LEFT JOIN classrooms c ON s.class_id = c.id
        LEFT JOIN teachers t ON s.class_teacher_id = t.id
        WHERE s.room_id = $1
        ORDER BY s.section_name ASC
      `,
        [roomId],
      );
      return result.rows.map(normalizeSectionRow);
    } finally {
      client.release();
    }
  },

  async getByClassId(pool, classId) {
    await this.ensure(pool);
    const client = await pool.connect();
    try {
      const result = await client.query(
        `
        SELECT s.*, r.room_number, r.floor_number, c.id AS class_id, c.name AS class_name,
               COALESCE(t.full_name, 'Not assigned') as class_teacher_name, t.employee_id as teacher_employee_id
        FROM sections s
        LEFT JOIN rooms r ON s.room_id = r.id
        LEFT JOIN classrooms c ON s.class_id = c.id
        LEFT JOIN teachers t ON s.class_teacher_id = t.id
        WHERE s.class_id = $1
        ORDER BY s.section_name ASC
      `,
        [classId],
      );
      return result.rows.map(normalizeSectionRow);
    } finally {
      client.release();
    }
  },
};

module.exports = sectionsService;

function normalizeSectionRow(row) {
  if (!row) return row;
  const r = { ...row };
  if ((r.section_name === undefined || r.section_name === null) && r.name) {
    r.section_name = r.name;
  }
  if (r.class_name !== undefined) {
    r.class = { id: r.class_id || null, class_name: r.class_name };
  } else if (r.class_id) {
    r.class = { id: r.class_id };
  }
  return r;
}
