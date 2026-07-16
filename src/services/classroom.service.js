class ClassroomService {
  ensure = async (pool) => {
    const sql = `
      CREATE TABLE IF NOT EXISTS classrooms (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        total_capacity INT DEFAULT 0,
        number_of_sections INT DEFAULT 0,
        class_teacher_id UUID,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    const client = await pool.connect();
    try {
      await client.query(sql);
      await client.query(
        "ALTER TABLE classrooms DROP COLUMN IF EXISTS monitor_name",
      );
      await client.query(
        "ALTER TABLE classrooms DROP COLUMN IF EXISTS room_number",
      );
      await client.query(
        "ALTER TABLE classrooms DROP COLUMN IF EXISTS room_type",
      );
      await client.query(
        "ALTER TABLE classrooms DROP COLUMN IF EXISTS floor_number",
      );
      await client.query(
        "ALTER TABLE classrooms ADD COLUMN IF NOT EXISTS total_capacity INT DEFAULT 0",
      );
      await client.query(
        "ALTER TABLE classrooms ADD COLUMN IF NOT EXISTS number_of_sections INT DEFAULT 0",
      );
      await client.query(
        "ALTER TABLE classrooms ADD COLUMN IF NOT EXISTS class_teacher_id UUID",
      );
      await client.query(
        "ALTER TABLE classrooms ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE",
      );
    } finally {
      client.release();
    }
  };

  list = async (req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
      await this.ensure(pool);
      const res = await pool.query(
          `SELECT c.*, COALESCE(counts.section_count, 0)::int AS number_of_sections
         FROM classrooms c
         LEFT JOIN (
           SELECT class_id AS classroom_id, COUNT(*) AS section_count
           FROM sections
           GROUP BY class_id
         ) counts ON counts.classroom_id = c.id
         ORDER BY c.name`,
      );
      return res.rows;
    } catch (err) {
      throw new Error(`Failed to list classrooms: ${err.message}`);
    }
  };

  create = async (data, req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
      await this.ensure(pool);
      const res = await pool.query(
        "INSERT INTO classrooms (name, total_capacity, number_of_sections) VALUES ($1,$2,$3) RETURNING *",
        [data.name, data.total_capacity || 0, data.number_of_sections || 0],
      );
      return res.rows[0];
    } catch (err) {
      throw new Error(`Failed to create classroom: ${err.message}`);
    }
  };

  update = async (id, data, req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
      await this.ensure(pool);
      const fields = [];
      const values = [];
      let idx = 1;
      const allowed = ["name", "total_capacity", "number_of_sections"];
      for (const k of allowed) {
        if (data[k] !== undefined) {
          fields.push(`${k} = $${idx++}`);
          values.push(data[k]);
        }
      }
      if (fields.length === 0) {
        const res = await pool.query("SELECT * FROM classrooms WHERE id = $1", [
          id,
        ]);
        return res.rows[0] || null;
      }
      const q = `UPDATE classrooms SET ${fields.join(", ")}, updated_at = CURRENT_TIMESTAMP WHERE id = $${idx} RETURNING *`;
      values.push(id);
      const res = await pool.query(q, values);
      return res.rows[0] || null;
    } catch (err) {
      throw new Error(`Failed to update classroom: ${err.message}`);
    }
  };

  remove = async (id, req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
      await this.ensure(pool);
      const res = await pool.query(
        "DELETE FROM classrooms WHERE id = $1 RETURNING id",
        [id],
      );
      return res.rows[0] || null;
    } catch (err) {
      throw new Error(`Failed to delete classroom: ${err.message}`);
    }
  };

  ensureSections = async (pool) => {
    // The sections table is ensured by sections.service.js
    // No need to ensure classroom_sections anymore
  };

  createSections = async (classroomId, sections, req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
      await this.ensure(pool);
      await this.ensureSections(pool);
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const created = [];
        for (const section of sections) {
          const name = section.name || section;
          const classTeacherId = section.class_teacher_id || null;
          const res = await client.query(
            "INSERT INTO sections (class_id, section_name, class_teacher_id) VALUES ($1,$2,$3) RETURNING *",
            [classroomId, name, classTeacherId],
          );
          created.push(res.rows[0]);
        }

        // Update classrooms.number_of_sections to reflect current count
        await client.query(
          `UPDATE classrooms SET number_of_sections = (
             SELECT COUNT(*) FROM sections WHERE class_id = $1
           ) WHERE id = $1`,
          [classroomId],
        );
        await client.query("COMMIT");
        return created;
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }
    } catch (err) {
      throw new Error(`Failed to create classroom sections: ${err.message}`);
    }
  };

  listSections = async (classroomId, req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
      await this.ensure(pool);
      await this.ensureSections(pool);
      const res = await pool.query(
        `SELECT 
          cs.id, 
          cs.class_id AS classroom_id, 
          cs.section_name AS section_name,
          cs.class_teacher_id,
          COALESCE(t.full_name, 'Not assigned') as class_teacher_name,
          t.employee_id,
          t.work_email
        FROM sections cs
        LEFT JOIN teachers t ON cs.class_teacher_id = t.id
        WHERE cs.class_id = $1 
        ORDER BY cs.section_name`,
        [classroomId],
      );
      return res.rows || [];
    } catch (err) {
      throw new Error(`Failed to list classroom sections: ${err.message}`);
    }
  };

  updateSection = async (sectionId, data, req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
      await this.ensure(pool);
      await this.ensureSections(pool);

      // Handle both old format (just name as string) and new format (object with name and class_teacher_id)
      const name = typeof data === "string" ? data : data?.name;
      const classTeacherId =
        typeof data === "object" ? data?.class_teacher_id : null;

      const q = `UPDATE sections SET section_name = $1, class_teacher_id = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *`;
      const res = await pool.query(q, [name, classTeacherId, sectionId]);
      return res.rows[0] || null;
    } catch (err) {
      throw new Error(`Failed to update classroom section: ${err.message}`);
    }
  };

  deleteSection = async (sectionId, req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
      await this.ensure(pool);
      await this.ensureSections(pool);
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const delRes = await client.query(
          "DELETE FROM sections WHERE id = $1 RETURNING class_id as classroom_id",
          [sectionId],
        );
        const classroomId = delRes.rows[0] ? delRes.rows[0].classroom_id : null;
        if (classroomId) {
          await client.query(
            `UPDATE classrooms SET number_of_sections = (
               SELECT COUNT(*) FROM sections WHERE class_id = $1
             ) WHERE id = $1`,
            [classroomId],
          );
        }
        await client.query("COMMIT");
        return delRes.rows[0] || null;
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }
    } catch (err) {
      throw new Error(`Failed to delete classroom section: ${err.message}`);
    }
  };
}

module.exports = new ClassroomService();
