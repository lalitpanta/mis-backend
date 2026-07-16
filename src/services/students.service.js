const { getTenantPool } = require("../config/tenantDb");

class StudentsService {
  // Ensure classes, sections, students and enrollments tables exist
  ensureTable = async (pool) => {
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

      -- classroom_sections table removed (not used)
    `;
    await pool.query(sql);
    await pool.query(
      "ALTER TABLE classrooms ADD COLUMN IF NOT EXISTS room_number VARCHAR(20)",
    );
    await pool.query(
      "ALTER TABLE classrooms ADD COLUMN IF NOT EXISTS room_type VARCHAR(50)",
    );

    // Ensure classes table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS classes (
        id SERIAL PRIMARY KEY,
        class_name VARCHAR(100) NOT NULL,
        total_students INTEGER NOT NULL DEFAULT 0,
        faculty VARCHAR(255),
        number_of_sections INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Ensure sections table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sections (
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
      );
    `);

    // Add indexes for sections
    await pool.query(
      "CREATE INDEX IF NOT EXISTS idx_sections_class_id ON sections(class_id)",
    );

    // Recreate students table with comprehensive fields for university and school level
    const createStudentsSql = `
      CREATE TABLE IF NOT EXISTS students (
        id SERIAL PRIMARY KEY,
        student_type VARCHAR(20) NOT NULL DEFAULT 'school',
        
        -- PERSONAL/BASIC INFORMATION
        full_name VARCHAR(100) NOT NULL,
        profile_picture TEXT,
        nationality VARCHAR(50),
        gender VARCHAR(10),
        date_of_birth DATE,
        legal_entity VARCHAR(255),
        batch VARCHAR(50),
        semester VARCHAR(50),
        roll_no INT,
        university_reg_no VARCHAR(50),
        admission_no VARCHAR(50),
        admission_date DATE,
        category_stream VARCHAR(255),
        
        -- CONTACT INFORMATION
        student_mail VARCHAR(100),
        school_email VARCHAR(100),
        phone_no VARCHAR(20),
        address TEXT,
        current_address TEXT,
        home_district VARCHAR(100),
        home_municipality VARCHAR(100),
        home_ward VARCHAR(100),
        home_full_address TEXT,
        
        -- FAMILY INFORMATION
        father_name VARCHAR(100),
        father_qualification VARCHAR(255),
        father_profession VARCHAR(100),
        father_organization VARCHAR(255),
        mother_name VARCHAR(100),
        mother_qualification VARCHAR(255),
        mother_profession VARCHAR(100),
        mother_organization VARCHAR(255),
        guardian_name VARCHAR(100),
        guardian_email VARCHAR(100),
        guardian_phone VARCHAR(20),
        guardian_qualification VARCHAR(255),
        guardian_profession VARCHAR(100),
        guardian_organization VARCHAR(255),
        siblings_info JSONB,
        
        -- TRANSPORTATION & HOSTEL
        transportation_required BOOLEAN DEFAULT FALSE,
        bus_service BOOLEAN DEFAULT FALSE,
        hostel_required BOOLEAN DEFAULT FALSE,
        
        -- DIETARY INFORMATION
        meal_type VARCHAR(50),
        meal_eligibility_date DATE,
        
        -- LEARNING & ECA
        eca_interests TEXT,
        learning_styles TEXT,
        
        -- PREVIOUS EDUCATION
        previous_school VARCHAR(255),
        previous_education JSONB,
        
        -- MEDICAL INFORMATION
        blood_group VARCHAR(20),
        allergies TEXT,
        height DECIMAL(5,2),
        weight DECIMAL(5,2),
        measurement_date DATE,
        vaccination_records JSONB,
        special_needs TEXT,
        medical_notes TEXT,
        documents JSONB DEFAULT '[]'::jsonb,
        
        -- CLASSROOM LINK
        classroom_id INT REFERENCES classrooms(id) ON DELETE SET NULL,
        
        -- STATUS & TIMESTAMPS
        is_active BOOLEAN DEFAULT TRUE,
        additional_info TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await pool.query(createStudentsSql);
    // Ensure class_id and section_id exist to link with classes/sections
    await pool.query(
      "ALTER TABLE students ADD COLUMN IF NOT EXISTS class_id INTEGER REFERENCES classes(id) ON DELETE SET NULL",
    );

    // Drop existing section_id foreign key if it exists and has wrong references
    try {
      await pool.query(`
        ALTER TABLE students DROP CONSTRAINT IF EXISTS students_section_id_fkey;
      `);
    } catch (err) {
      // Ignore if constraint doesn't exist
    }

    // Add section_id with proper foreign key constraint
    try {
      await pool.query(
        "ALTER TABLE students ADD COLUMN IF NOT EXISTS section_id INTEGER REFERENCES sections(id) ON DELETE SET NULL",
      );
    } catch (err) {
      // Column might already exist, try to add just the constraint
      if (err.message.includes("already exists")) {
        try {
          await pool.query(`
            ALTER TABLE students ADD CONSTRAINT students_section_id_fkey 
            FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE SET NULL;
          `);
        } catch (constraintErr) {
          // Constraint might already exist, ignore
        }
      } else {
        throw err;
      }
    }

    await pool.query(
      "CREATE INDEX IF NOT EXISTS idx_students_class_id ON students(class_id)",
    );
    await pool.query(
      "CREATE INDEX IF NOT EXISTS idx_students_section_id ON students(section_id)",
    );
    // Ensure guardian_email and documents columns exist for existing tenant DBs
    await pool.query(
      "ALTER TABLE students ADD COLUMN IF NOT EXISTS guardian_email VARCHAR(100)",
    );
    await pool.query(
      "ALTER TABLE students ADD COLUMN IF NOT EXISTS documents JSONB DEFAULT '[]'::jsonb",
    );
  };

  list = async (req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
      await this.ensureTable(pool);
      // Detect whether classes/sections use 'class_name'/'section_name' or legacy 'name'
      const classColRes = await pool.query(
        "SELECT column_name FROM information_schema.columns WHERE table_name = 'classes' AND column_name = 'class_name'",
      );
      const hasClassName = classColRes.rows.length > 0;
      const sectionColRes = await pool.query(
        "SELECT column_name FROM information_schema.columns WHERE table_name = 'sections' AND column_name = 'section_name'",
      );
      const hasSectionName = sectionColRes.rows.length > 0;

      const classSelect = hasClassName
        ? "c.id AS class_id, c.class_name AS class_name"
        : "c.id AS class_id, c.name AS class_name";
      const sectionSelect = hasSectionName
        ? "se.id AS section_id, se.section_name AS section_name"
        : "se.id AS section_id, se.name AS section_name";

      const q = `SELECT s.*, cr.name AS classroom_name, ${classSelect}, ${sectionSelect}
                 FROM students s
                 LEFT JOIN classrooms cr ON s.classroom_id = cr.id
                 LEFT JOIN classes c ON s.class_id = c.id
                 LEFT JOIN sections se ON s.section_id = se.id
                 ORDER BY s.created_at DESC`;
      try {
        const res = await pool.query(q);
        return res.rows;
      } catch (err) {
        // fallback for tenants with unexpected schema drift where column detection was wrong
        if (err && err.code === "42703") {
          const simpleQ = `SELECT s.*, cr.name AS classroom_name FROM students s LEFT JOIN classrooms cr ON s.classroom_id = cr.id ORDER BY s.created_at DESC`;
          const res2 = await pool.query(simpleQ);
          const rows = res2.rows || [];
          // enrich with class/section names via batched queries
          const classIds = [
            ...new Set(rows.map((r) => r.class_id).filter(Boolean)),
          ];
          const sectionIds = [
            ...new Set(rows.map((r) => r.section_id).filter(Boolean)),
          ];
          const classMap = {};
          const sectionMap = {};
          if (classIds.length) {
            const cres = await pool.query(
              `SELECT id, COALESCE(class_name, name) AS class_name FROM classes WHERE id = ANY($1::int[])`,
              [classIds],
            );
            cres.rows.forEach((r) => {
              classMap[r.id] = r.class_name;
            });
          }
          if (sectionIds.length) {
            const sres = await pool.query(
              `SELECT id, COALESCE(section_name, name) AS section_name FROM sections WHERE id = ANY($1::int[])`,
              [sectionIds],
            );
            sres.rows.forEach((r) => {
              sectionMap[r.id] = r.section_name;
            });
          }
          return rows.map((r) => ({
            ...r,
            class_name: classMap[r.class_id] || null,
            section_name: sectionMap[r.section_id] || null,
          }));
        }
        throw err;
      }
    } catch (err) {
      throw new Error(`Failed to list students: ${err.message}`);
    }
  };

  get = async (id, req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
      await this.ensureTable(pool);
      const classColRes = await pool.query(
        "SELECT column_name FROM information_schema.columns WHERE table_name = 'classes' AND column_name = 'class_name'",
      );
      const hasClassName = classColRes.rows.length > 0;
      const sectionColRes = await pool.query(
        "SELECT column_name FROM information_schema.columns WHERE table_name = 'sections' AND column_name = 'section_name'",
      );
      const hasSectionName = sectionColRes.rows.length > 0;

      const classSelect = hasClassName
        ? "c.id AS class_id, c.class_name AS class_name"
        : "c.id AS class_id, c.name AS class_name";
      const sectionSelect = hasSectionName
        ? "se.id AS section_id, se.section_name AS section_name"
        : "se.id AS section_id, se.name AS section_name";

      const q = `SELECT s.*, cr.name AS classroom_name, ${classSelect}, ${sectionSelect}
                 FROM students s
                 LEFT JOIN classrooms cr ON s.classroom_id = cr.id
                 LEFT JOIN classes c ON s.class_id = c.id
                 LEFT JOIN sections se ON s.section_id = se.id
                 WHERE s.id = $1`;
      try {
        const res = await pool.query(q, [id]);
        return res.rows[0] || null;
      } catch (err) {
        if (err && err.code === "42703") {
          const simpleQ = `SELECT s.*, cr.name AS classroom_name FROM students s LEFT JOIN classrooms cr ON s.classroom_id = cr.id WHERE s.id = $1`;
          const res2 = await pool.query(simpleQ, [id]);
          const row = res2.rows[0] || null;
          if (!row) return null;
          // enrich
          if (row.class_id) {
            const cres = await pool.query(
              `SELECT id, COALESCE(class_name, name) AS class_name FROM classes WHERE id = $1`,
              [row.class_id],
            );
            row.class_name = cres.rows[0] ? cres.rows[0].class_name : null;
          }
          if (row.section_id) {
            const sres = await pool.query(
              `SELECT id, COALESCE(section_name, name) AS section_name FROM sections WHERE id = $1`,
              [row.section_id],
            );
            row.section_name = sres.rows[0] ? sres.rows[0].section_name : null;
          }
          return row;
        }
        throw err;
      }
    } catch (err) {
      throw new Error(`Failed to fetch student ${id}: ${err.message}`);
    }
  };

  create = async (data, req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
      await this.ensureTable(pool);

      // Validate section_id if provided
      if (
        data.section_id &&
        data.section_id !== null &&
        data.section_id !== ""
      ) {
        const sectionExists = await pool.query(
          "SELECT id FROM sections WHERE id = $1",
          [parseInt(data.section_id, 10)],
        );
        if (sectionExists.rows.length === 0) {
          throw new Error(
            `Section with ID ${data.section_id} does not exist. Please create a section first or remove the section_id from the request.`,
          );
        }
      }

      // Validate class_id if provided
      if (data.class_id && data.class_id !== null && data.class_id !== "") {
        const classExists = await pool.query(
          "SELECT id FROM classes WHERE id = $1",
          [parseInt(data.class_id, 10)],
        );
        if (classExists.rows.length === 0) {
          throw new Error(
            `Class with ID ${data.class_id} does not exist. Please create a class first or remove the class_id from the request.`,
          );
        }
      }

      const columns = [
        "student_type",
        "full_name",
        "profile_picture",
        "nationality",
        "gender",
        "date_of_birth",
        "legal_entity",
        "batch",
        "semester",
        "roll_no",
        "university_reg_no",
        "admission_no",
        "admission_date",
        "category_stream",
        "student_mail",
        "school_email",
        "phone_no",
        "address",
        "current_address",
        "home_district",
        "home_municipality",
        "home_ward",
        "home_full_address",
        "father_name",
        "father_qualification",
        "father_profession",
        "father_organization",
        "mother_name",
        "mother_qualification",
        "mother_profession",
        "mother_organization",
        "guardian_name",
        "guardian_email",
        "guardian_phone",
        "guardian_qualification",
        "guardian_profession",
        "guardian_organization",
        "siblings_info",
        "transportation_required",
        "bus_service",
        "hostel_required",
        "meal_type",
        "meal_eligibility_date",
        "eca_interests",
        "learning_styles",
        "previous_school",
        "previous_education",
        "blood_group",
        "allergies",
        "height",
        "weight",
        "measurement_date",
        "vaccination_records",
        "special_needs",
        "medical_notes",
        "documents",
        "classroom_id",
        "is_active",
        "additional_info",
      ];
      // include new mapping fields for classes/sections
      if (!columns.includes("class_id")) columns.push("class_id");
      if (!columns.includes("section_id")) columns.push("section_id");

      const placeholders = columns.map((_, i) => `$${i + 1}`).join(",");
      const columnNames = columns.join(",");

      const vals = columns.map((col) => {
        if (col === "student_type") {
          return data[col] || "school";
        }
        if (
          col === "siblings_info" ||
          col === "previous_education" ||
          col === "vaccination_records" ||
          col === "documents"
        ) {
          return typeof data[col] === "object"
            ? JSON.stringify(data[col])
            : data[col] || null;
        }
        if (
          col === "transportation_required" ||
          col === "bus_service" ||
          col === "hostel_required" ||
          col === "is_active"
        ) {
          return data[col] === undefined
            ? col === "is_active"
              ? true
              : false
            : data[col];
        }
        // Convert integer fields
        if (
          ["roll_no", "classroom_id", "class_id", "section_id"].includes(col)
        ) {
          const val = data[col];
          if (val === null || val === undefined || val === "") return null;
          const parsed = parseInt(val, 10);
          return isNaN(parsed) ? null : parsed;
        }
        // Convert decimal fields
        if (["height", "weight"].includes(col)) {
          const val = data[col];
          if (val === null || val === undefined || val === "") return null;
          const parsed = parseFloat(val);
          return isNaN(parsed) ? null : parsed;
        }
        return data[col] || null;
      });

      const q = `INSERT INTO students (${columnNames}) VALUES (${placeholders}) RETURNING *`;
      const res = await pool.query(q, vals);
      return res.rows[0];
    } catch (err) {
      throw new Error(`Failed to create student: ${err.message}`);
    }
  };

  update = async (id, data, req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
      await this.ensureTable(pool);
      const fields = [];
      const values = [];
      let idx = 1;

      const allowed = [
        "student_type",
        "full_name",
        "profile_picture",
        "nationality",
        "gender",
        "date_of_birth",
        "legal_entity",
        "batch",
        "semester",
        "roll_no",
        "university_reg_no",
        "admission_no",
        "admission_date",
        "category_stream",
        "student_mail",
        "school_email",
        "phone_no",
        "address",
        "current_address",
        "home_district",
        "home_municipality",
        "home_ward",
        "home_full_address",
        "father_name",
        "father_qualification",
        "father_profession",
        "father_organization",
        "mother_name",
        "mother_qualification",
        "mother_profession",
        "mother_organization",
        "guardian_name",
        "guardian_email",
        "guardian_phone",
        "guardian_qualification",
        "guardian_profession",
        "guardian_organization",
        "siblings_info",
        "transportation_required",
        "bus_service",
        "hostel_required",
        "meal_type",
        "meal_eligibility_date",
        "eca_interests",
        "learning_styles",
        "previous_school",
        "previous_education",
        "blood_group",
        "allergies",
        "height",
        "weight",
        "measurement_date",
        "vaccination_records",
        "special_needs",
        "medical_notes",
        "documents",
        "classroom_id",
        "class_id",
        "section_id",
        "is_active",
        "additional_info",
      ];

      for (const key of allowed) {
        if (data[key] !== undefined) {
          if (
            key === "siblings_info" ||
            key === "previous_education" ||
            key === "vaccination_records" ||
            key === "documents"
          ) {
            fields.push(`${key} = $${idx++}`);
            values.push(
              typeof data[key] === "object"
                ? JSON.stringify(data[key])
                : data[key],
            );
          } else if (["roll_no", "classroom_id", "class_id", "section_id"].includes(key)) {
            // Convert integer fields
            const val = data[key];
            if (val === null || val === undefined || val === "") {
              fields.push(`${key} = $${idx++}`);
              values.push(null);
            } else {
              const parsed = parseInt(val, 10);
              fields.push(`${key} = $${idx++}`);
              values.push(isNaN(parsed) ? null : parsed);
            }
          } else if (["height", "weight"].includes(key)) {
            // Convert decimal fields
            const val = data[key];
            if (val === null || val === undefined || val === "") {
              fields.push(`${key} = $${idx++}`);
              values.push(null);
            } else {
              const parsed = parseFloat(val);
              fields.push(`${key} = $${idx++}`);
              values.push(isNaN(parsed) ? null : parsed);
            }
          } else if (
            key === "transportation_required" ||
            key === "bus_service" ||
            key === "hostel_required" ||
            key === "is_active"
          ) {
            fields.push(`${key} = $${idx++}`);
            values.push(data[key]);
          } else if (
            ["date_of_birth", "admission_date", "meal_eligibility_date", "measurement_date"].includes(key)
          ) {
            fields.push(`${key} = $${idx++}`);
            values.push(data[key] || null);
          } else {
            fields.push(`${key} = $${idx++}`);
            values.push(data[key]);
          }
        }
      }

      if (fields.length === 0) return this.get(id, req);
      const q = `UPDATE students SET ${fields.join(", ")}, updated_at = CURRENT_TIMESTAMP WHERE id = $${idx} RETURNING *`;
      values.push(id);
      const res = await pool.query(q, values);
      return res.rows[0];
    } catch (err) {
      throw new Error(`Failed to update student ${id}: ${err.message}`);
    }
  };

  remove = async (id, req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
      await this.ensureTable(pool);
      const q = `DELETE FROM students WHERE id = $1 RETURNING id`;
      const res = await pool.query(q, [id]);
      return res.rows[0] || null;
    } catch (err) {
      throw new Error(`Failed to delete student ${id}: ${err.message}`);
    }
  };

  importBulk = async (students, req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
      await this.ensureTable(pool);
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const created = [];
        for (const s of students) {
          const res = await this.create(s, { tenantPool: client });
          created.push(res);
        }
        await client.query("COMMIT");
        return created;
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }
    } catch (err) {
      throw new Error(`Failed to import students: ${err.message}`);
    }
  };

  exportCsv = async (req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
      await this.ensureTable(pool);

      const headers = [
        "id",
        "student_type",
        "full_name",
        "profile_picture",
        "nationality",
        "gender",
        "date_of_birth",
        "legal_entity",
        "batch",
        "semester",
        "roll_no",
        "university_reg_no",
        "admission_no",
        "admission_date",
        "category_stream",
        "student_mail",
        "school_email",
        "phone_no",
        "address",
        "current_address",
        "home_district",
        "home_municipality",
        "home_ward",
        "home_full_address",
        "father_name",
        "father_qualification",
        "father_profession",
        "father_organization",
        "mother_name",
        "mother_qualification",
        "mother_profession",
        "mother_organization",
        "guardian_name",
        "guardian_phone",
        "guardian_qualification",
        "guardian_profession",
        "guardian_organization",
        "transportation_required",
        "bus_service",
        "hostel_required",
        "meal_type",
        "meal_eligibility_date",
        "eca_interests",
        "learning_styles",
        "previous_school",
        "blood_group",
        "allergies",
        "height",
        "weight",
        "measurement_date",
        "special_needs",
        "medical_notes",
        "documents",
        "classroom_id",
        "is_active",
        "additional_info",
      ];

      const q = `SELECT ${headers.join(", ")} FROM students ORDER BY created_at DESC`;
      const res = await pool.query(q);
      const rows = res.rows || [];

      const csv = [headers.join(",")]
        .concat(
          rows.map((r) =>
            headers
              .map((h) => {
                const v = r[h];
                if (v === null || v === undefined) return "";
                return `"${String(v).replace(/"/g, '""')}"`;
              })
              .join(","),
          ),
        )
        .join("\n");

      return csv;
    } catch (err) {
      throw new Error(`Failed to export students: ${err.message}`);
    }
  };

  removeDocument = async (id, docId, req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
      await this.ensureTable(pool);
      const student = await this.get(id, req);
      if (!student) return null;
      const docs = Array.isArray(student.documents) ? student.documents : [];
      const filtered = docs.filter((d) => String(d.id) !== String(docId));
      if (filtered.length === docs.length) return null; // not found
      // Use update to persist
      const updated = await this.update(id, { documents: filtered }, req);
      return updated;
    } catch (err) {
      throw new Error(
        `Failed to remove document ${docId} for student ${id}: ${err.message}`,
      );
    }
  };
}

module.exports = new StudentsService();
