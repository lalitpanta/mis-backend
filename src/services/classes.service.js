const classesService = {
  // Ensure classes table exists
  async ensure(pool) {
    const client = await pool.connect();
    try {
      const tableExists = await client.query(`
        SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'classes')
      `);
      if (!tableExists.rows[0].exists) {
        await client.query(`
          CREATE TABLE classes (
            id SERIAL PRIMARY KEY,
            class_name VARCHAR(100) NOT NULL,
            total_students INTEGER NOT NULL DEFAULT 0,
            faculty VARCHAR(255),
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
          )
        `);
        await client.query(`CREATE INDEX idx_classes_class_name ON classes(class_name)`);
      }
    } finally {
      client.release();
    }
  },

  async getAll(pool) {
    const client = await pool.connect();
    try {
      try {
        const result = await client.query('SELECT * FROM classes ORDER BY class_name ASC');
        return result.rows.map(normalizeClassRow);
      } catch (err) {
        // If the tenant's classes table doesn't have `class_name`, fall back to unsorted select
        if (err && err.code === '42703') {
          const result = await client.query('SELECT * FROM classes');
          return result.rows.map(normalizeClassRow);
        }
        throw err;
      }
    } finally {
      client.release();
    }
  },

  async getById(pool, id) {
    const client = await pool.connect();
    try {
      const result = await client.query('SELECT * FROM classes WHERE id = $1', [id]);
      return result.rows[0] ? normalizeClassRow(result.rows[0]) : null;
    } finally {
      client.release();
    }
  },

  async create(pool, data) {
    const { class_name, total_students, faculty } = data;
    const client = await pool.connect();
    try {
      const colsRes = await client.query(
        "SELECT column_name FROM information_schema.columns WHERE table_name = 'classes'"
      );
      const colSet = new Set(colsRes.rows.map(r => r.column_name));

      const insertCols = [];
      const values = [];

      if (class_name !== undefined && class_name !== null) {
        if (colSet.has('class_name')) {
          insertCols.push('class_name');
          values.push(class_name);
        } else if (colSet.has('name')) {
          insertCols.push('name');
          values.push(class_name);
        }
      }

      if (total_students !== undefined && colSet.has('total_students')) {
        insertCols.push('total_students');
        values.push(total_students);
      }

      // support legacy total students column names
      if ((total_students !== undefined) && insertCols.indexOf('total_students') === -1) {
        if (colSet.has('total')) {
          insertCols.push('total');
          values.push(total_students);
        } else if (colSet.has('students')) {
          insertCols.push('students');
          values.push(total_students);
        } else if (colSet.has('student_count')) {
          insertCols.push('student_count');
          values.push(total_students);
        }
      }

      if (faculty !== undefined && colSet.has('faculty')) {
        insertCols.push('faculty');
        values.push(faculty);
      }

      // support legacy faculty column names
      if ((faculty !== undefined) && insertCols.indexOf('faculty') === -1) {
        if (colSet.has('teacher')) {
          insertCols.push('teacher');
          values.push(faculty);
        } else if (colSet.has('faculty_name')) {
          insertCols.push('faculty_name');
          values.push(faculty);
        } else if (colSet.has('class_teacher')) {
          insertCols.push('class_teacher');
          values.push(faculty);
        }
      }

      if (insertCols.length === 0) {
        throw new Error('No valid columns available for INSERT on classes table');
      }

      const placeholders = insertCols.map((_, i) => `$${i + 1}`).join(', ');
      const result = await client.query(
        `INSERT INTO classes (${insertCols.join(',')}) VALUES (${placeholders}) RETURNING *`,
        values
      );
      return result.rows[0] ? normalizeClassRow(result.rows[0]) : null;
    } finally {
      client.release();
    }
  },

  async update(pool, id, data) {
    const allowed = ['class_name', 'total_students', 'faculty'];
    const client = await pool.connect();
    try {
      const colsRes = await client.query(
        "SELECT column_name FROM information_schema.columns WHERE table_name = 'classes'"
      );
      const colSet = new Set(colsRes.rows.map(r => r.column_name));

      const fields = [];
      const values = [];
      let paramCount = 1;

      for (const [key, val] of Object.entries(data)) {
        if (!allowed.includes(key)) continue;

        if (key === 'class_name') {
          if (colSet.has('class_name')) {
            fields.push(`class_name = $${paramCount++}`);
            values.push(val);
          } else if (colSet.has('name')) {
            fields.push(`name = $${paramCount++}`);
            values.push(val);
          }
        } else if (key === 'total_students') {
          if (colSet.has('total_students')) {
            fields.push(`total_students = $${paramCount++}`);
            values.push(val);
          } else if (colSet.has('total')) {
            fields.push(`total = $${paramCount++}`);
            values.push(val);
          } else if (colSet.has('students')) {
            fields.push(`students = $${paramCount++}`);
            values.push(val);
          } else if (colSet.has('student_count')) {
            fields.push(`student_count = $${paramCount++}`);
            values.push(val);
          }
        } else if (key === 'faculty') {
          if (colSet.has('faculty')) {
            fields.push(`faculty = $${paramCount++}`);
            values.push(val);
          } else if (colSet.has('teacher')) {
            fields.push(`teacher = $${paramCount++}`);
            values.push(val);
          } else if (colSet.has('faculty_name')) {
            fields.push(`faculty_name = $${paramCount++}`);
            values.push(val);
          } else if (colSet.has('class_teacher')) {
            fields.push(`class_teacher = $${paramCount++}`);
            values.push(val);
          }
        }
      }

      if (fields.length === 0) return await this.getById(pool, id);

      fields.push(`updated_at = $${paramCount++}`);
      values.push(new Date());
      values.push(id);

      const result = await client.query(
        `UPDATE classes SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
        values
      );
      return result.rows[0] ? normalizeClassRow(result.rows[0]) : null;
    } finally {
      client.release();
    }
  },

  async delete(pool, id) {
    const client = await pool.connect();
    try {
      await client.query('DELETE FROM classes WHERE id = $1', [id]);
      return true;
    } finally {
      client.release();
    }
  },
};

module.exports = classesService;

function normalizeClassRow(row) {
  if (!row) return row;
  const r = { ...row };
  // Normalize legacy `name` -> `class_name`
  if ((r.class_name === undefined || r.class_name === null) && r.name) {
    r.class_name = r.name;
  }
  // Normalize legacy total student columns
  if (r.total_students === undefined || r.total_students === null) {
    if (r.total !== undefined && r.total !== null) r.total_students = r.total;
    else if (r.students !== undefined && r.students !== null) r.total_students = r.students;
    else if (r.student_count !== undefined && r.student_count !== null) r.total_students = r.student_count;
  }

  // Normalize legacy faculty columns
  if ((r.faculty === undefined || r.faculty === null)) {
    if (r.teacher !== undefined && r.teacher !== null) r.faculty = r.teacher;
    else if (r.faculty_name !== undefined && r.faculty_name !== null) r.faculty = r.faculty_name;
    else if (r.class_teacher !== undefined && r.class_teacher !== null) r.faculty = r.class_teacher;
  }
  return r;
}
