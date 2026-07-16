const { v4: uuidv4 } = require("uuid");

class TeacherService {
  ensureTable = async (pool) => {
    try {
      await pool.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
    } catch (err) {
      // ignore extension creation errors
    }

    const createTableSql = `
      CREATE TABLE IF NOT EXISTS teachers (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        employee_id VARCHAR(100) UNIQUE NOT NULL,
        full_name VARCHAR(255) NOT NULL,
        date_of_birth DATE,
        gender VARCHAR(50),
        blood_group VARCHAR(50),
        nationality VARCHAR(100),
        religion VARCHAR(100),
        ethnicity VARCHAR(100),
        marital_status VARCHAR(100),
        profile_photo_url TEXT,
        personal_email VARCHAR(255),
        personal_phone VARCHAR(100),
        alternate_phone VARCHAR(100),
        current_address TEXT,
        permanent_address TEXT,
        designation VARCHAR(100),
        department_id UUID,
        employment_type VARCHAR(100),
        join_date DATE,
        subjects_taught JSONB DEFAULT '[]'::jsonb,
        classes_assigned JSONB DEFAULT '[]'::jsonb,
        reporting_manager VARCHAR(255),
        work_email VARCHAR(255),
        work_phone VARCHAR(100),
        office_room VARCHAR(255),
        highest_qualification VARCHAR(100),
        institution_name VARCHAR(255),
        passed_year VARCHAR(50),
        major_subject VARCHAR(255),
        additional_certifications JSONB DEFAULT '[]'::jsonb,
        teaching_license_number VARCHAR(255),
        license_expiry_date DATE,
        previous_organization VARCHAR(255),
        previous_position VARCHAR(255),
        previous_from_date DATE,
        previous_to_date DATE,
        previous_leave_reason TEXT,
        total_years_experience NUMERIC,
        citizenship_number VARCHAR(255),
        citizenship_issued_date DATE,
        citizenship_issued_district VARCHAR(255),
        passport_number VARCHAR(255),
        passport_expiry_date DATE,
        pan_number VARCHAR(255),
        national_id_number VARCHAR(255),
        bank_name VARCHAR(255),
        bank_branch VARCHAR(255),
        account_number VARCHAR(255),
        account_holder_name VARCHAR(255),
        salary_grade VARCHAR(255),
        basic_salary NUMERIC,
        allowances JSONB DEFAULT '{}'::jsonb,
        provident_fund_number VARCHAR(255),
        insurance_number VARCHAR(255),
        emergency_contact_name VARCHAR(255),
        emergency_contact_relationship VARCHAR(255),
        emergency_contact_phone VARCHAR(100),
        emergency_contact_address TEXT,
        documents JSONB DEFAULT '[]'::jsonb,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await pool.query(createTableSql);

    // Ensure documents column exists (for backward compatibility with existing tables)
    try {
      await pool.query(`
        ALTER TABLE teachers
        ADD COLUMN IF NOT EXISTS documents JSONB DEFAULT '[]'::jsonb;
      `);
    } catch (err) {
      // Column already exists or other error - continue
      console.log("[TeacherService] documents column check:", err.message);
    }
  };

  listTeachers = async (req, filters = {}) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
      await this.ensureTable(pool);

      const conditions = ["teachers.is_active = TRUE"];
      const values = [];
      let idx = 1;

      // Permission filtering:
      // - system_admin, tenant, and staff can view all teachers
      // - teacher and student users can only view their own record
      if (req && req.user) {
        const t = req.user.type;
        if (t === "teacher" || t === "student") {
          conditions.push(`teachers.id = $${idx++}`);
          values.push(req.user.id);
        }
      }

      if (filters.department_id) {
        conditions.push(`teachers.department_id = $${idx++}`);
        values.push(filters.department_id);
      }
      if (filters.designation) {
        conditions.push(`teachers.designation ILIKE $${idx++}`);
        values.push(`%${filters.designation}%`);
      }
      if (filters.search) {
        conditions.push(`teachers.full_name ILIKE $${idx++}`);
        values.push(`%${filters.search}%`);
      }

      const query = `
        SELECT teachers.*, d.name AS department_name
        FROM teachers
        LEFT JOIN departments d ON teachers.department_id = d.id
        ${conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""}
        ORDER BY teachers.created_at DESC
      `;

      const result = await pool.query(query, values);
      return result.rows;
    } catch (err) {
      throw new Error(`Failed to list teachers: ${err.message}`);
    }
  };

  listTeacherOptions = async (req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
      await this.ensureTable(pool);
      const query = `
        SELECT id, employee_id, full_name, work_email, personal_email, personal_phone, work_phone, department_id
        FROM teachers
        WHERE is_active = TRUE
        ORDER BY full_name
      `;
      const res = await pool.query(query);
      return res.rows;
    } catch (err) {
      throw new Error(`Failed to fetch teacher options: ${err.message}`);
    }
  };

  getTeacher = async (id, req) => {
    try {
      // Permission check: Non-admin users can only view their own teacher record
      // Permission check:
      // - system_admin, tenant, and staff can view any teacher
      // - teacher and student can only view their own record
      if (req && req.user) {
        const t = req.user.type;
        if ((t === "teacher" || t === "student") && req.user.id !== id) {
          return null;
        }
      }

      const pool = req?.tenantPool || require("../config/db");
      await this.ensureTable(pool);
      const query = `SELECT * FROM teachers WHERE id = $1`;
      const result = await pool.query(query, [id]);
      return result.rows[0] || null;
    } catch (err) {
      throw new Error(`Failed to fetch teacher ${id}: ${err.message}`);
    }
  };

  createTeacher = async (data, req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
      await this.ensureTable(pool);

      const employeeId =
        data.employee_id?.trim() ||
        `TEA-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;
      const subjectsTaught = Array.isArray(data.subjects_taught)
        ? data.subjects_taught
        : data.subjects_taught
          ? [data.subjects_taught]
          : [];
      const classesAssigned = Array.isArray(data.classes_assigned)
        ? data.classes_assigned
        : data.classes_assigned
          ? [data.classes_assigned]
          : [];
      const additionalCertifications = Array.isArray(
        data.additional_certifications,
      )
        ? data.additional_certifications
        : data.additional_certifications
          ? [data.additional_certifications]
          : [];
      const allowances =
        typeof data.allowances === "object" && data.allowances !== null
          ? data.allowances
          : {
              travel: data.allowances?.travel ?? null,
              house: data.allowances?.house ?? null,
              medical: data.allowances?.medical ?? null,
            };
      const totalYears =
        data.total_years_experience ||
        this._computeYears(data.previous_from_date, data.previous_to_date);

      // normalize helper - convert empty strings to null
      const norm = (v) => {
        if (v === undefined) return undefined;
        if (v === "") return null;
        return v;
      };

      const query = `
        INSERT INTO teachers (
          employee_id, full_name, date_of_birth, gender, blood_group,
          nationality, religion, ethnicity, marital_status, profile_photo_url,
          personal_email, personal_phone, alternate_phone, current_address, permanent_address,
          designation, department_id, employment_type, join_date, subjects_taught,
          classes_assigned, reporting_manager, work_email, work_phone, office_room,
          highest_qualification, institution_name, passed_year, major_subject, additional_certifications,
          teaching_license_number, license_expiry_date, previous_organization, previous_position,
          previous_from_date, previous_to_date, previous_leave_reason, total_years_experience,
          citizenship_number, citizenship_issued_date, citizenship_issued_district,
          passport_number, passport_expiry_date, pan_number, national_id_number,
          bank_name, bank_branch, account_number, account_holder_name, salary_grade,
          basic_salary, allowances, provident_fund_number, insurance_number,
          emergency_contact_name, emergency_contact_relationship, emergency_contact_phone,
          emergency_contact_address, documents, is_active
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
          $11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
          $21,$22,$23,$24,$25,$26,$27,$28,$29,$30,
          $31,$32,$33,$34,$35,$36,$37,$38,$39,$40,
          $41,$42,$43,$44,$45,$46,$47,$48,$49,$50,
          $51,$52,$53,$54,$55,$56,$57,$58,$59,$60
        ) RETURNING *;
      `;

      const values = [
        employeeId,
        norm(data.full_name) ?? "",
        norm(data.date_of_birth) ?? null,
        norm(data.gender) ?? null,
        norm(data.blood_group) ?? null,
        norm(data.nationality) ?? null,
        norm(data.religion) ?? null,
        norm(data.ethnicity) ?? null,
        norm(data.marital_status) ?? null,
        norm(data.profile_photo_url) ?? null,
        norm(data.personal_email) ?? null,
        norm(data.personal_phone) ?? null,
        norm(data.alternate_phone) ?? null,
        norm(data.current_address) ?? null,
        norm(data.permanent_address) ?? null,
        norm(data.designation) ?? null,
        norm(data.department_id) ?? null,
        norm(data.employment_type) ?? null,
        norm(data.join_date) ?? null,
        JSON.stringify(subjectsTaught),
        JSON.stringify(classesAssigned),
        norm(data.reporting_manager) ?? null,
        norm(data.work_email) ?? null,
        norm(data.work_phone) ?? null,
        norm(data.office_room) ?? null,
        norm(data.highest_qualification) ?? null,
        norm(data.institution_name) ?? null,
        norm(data.passed_year) ?? null,
        norm(data.major_subject) ?? null,
        JSON.stringify(additionalCertifications),
        norm(data.teaching_license_number) ?? null,
        norm(data.license_expiry_date) ?? null,
        norm(data.previous_organization) ?? null,
        norm(data.previous_position) ?? null,
        norm(data.previous_from_date) ?? null,
        norm(data.previous_to_date) ?? null,
        norm(data.previous_leave_reason) ?? null,
        norm(totalYears) ?? null,
        norm(data.citizenship_number) ?? null,
        norm(data.citizenship_issued_date) ?? null,
        norm(data.citizenship_issued_district) ?? null,
        norm(data.passport_number) ?? null,
        norm(data.passport_expiry_date) ?? null,
        norm(data.pan_number) ?? null,
        norm(data.national_id_number) ?? null,
        norm(data.bank_name) ?? null,
        norm(data.bank_branch) ?? null,
        norm(data.account_number) ?? null,
        norm(data.account_holder_name) ?? null,
        norm(data.salary_grade) ?? null,
        norm(data.basic_salary) ?? null,
        JSON.stringify(allowances),
        norm(data.provident_fund_number) ?? null,
        norm(data.insurance_number) ?? null,
        norm(data.emergency_contact_name) ?? null,
        norm(data.emergency_contact_relationship) ?? null,
        norm(data.emergency_contact_phone) ?? null,
        norm(data.emergency_contact_address) ?? null,
        JSON.stringify(data.documents || []),
        data.is_active !== undefined ? data.is_active : true,
      ];

      console.log(
        "[TeacherService Create] Inserting documents:",
        values[values.length - 3],
      ); // documents is near end
      const result = await pool.query(query, values);
      console.log(
        "[TeacherService Create] Stored teacher:",
        result.rows[0]?.id,
        "documents count:",
        result.rows[0]?.documents?.length || 0,
      );
      return result.rows[0];
    } catch (err) {
      throw new Error(`Failed to create teacher: ${err.message}`);
    }
  };

  updateTeacher = async (id, data, req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
      await this.ensureTable(pool);

      const fields = [];
      const values = [];
      let idx = 1;

      const addField = (field, value, serialize = false) => {
        if (value !== undefined) {
          const normalized = value === "" ? null : value;
          fields.push(`${field} = $${idx++}`);
          values.push(
            serialize
              ? normalized === null
                ? null
                : JSON.stringify(normalized)
              : normalized,
          );
        }
      };

      addField("full_name", data.full_name);
      addField("date_of_birth", data.date_of_birth);
      addField("gender", data.gender);
      addField("blood_group", data.blood_group);
      addField("nationality", data.nationality);
      addField("religion", data.religion);
      addField("ethnicity", data.ethnicity);
      addField("marital_status", data.marital_status);
      addField("profile_photo_url", data.profile_photo_url);
      addField("personal_email", data.personal_email);
      addField("personal_phone", data.personal_phone);
      addField("alternate_phone", data.alternate_phone);
      addField("current_address", data.current_address);
      addField("permanent_address", data.permanent_address);
      addField("designation", data.designation);
      addField("department_id", data.department_id);
      addField("employment_type", data.employment_type);
      addField("join_date", data.join_date);
      addField("subjects_taught", data.subjects_taught, true);
      addField("classes_assigned", data.classes_assigned, true);
      addField("reporting_manager", data.reporting_manager);
      addField("work_email", data.work_email);
      addField("work_phone", data.work_phone);
      addField("office_room", data.office_room);
      addField("highest_qualification", data.highest_qualification);
      addField("institution_name", data.institution_name);
      addField("passed_year", data.passed_year);
      addField("major_subject", data.major_subject);
      addField(
        "additional_certifications",
        data.additional_certifications,
        true,
      );
      addField("teaching_license_number", data.teaching_license_number);
      addField("license_expiry_date", data.license_expiry_date);
      addField("previous_organization", data.previous_organization);
      addField("previous_position", data.previous_position);
      addField("previous_from_date", data.previous_from_date);
      addField("previous_to_date", data.previous_to_date);
      addField("previous_leave_reason", data.previous_leave_reason);
      addField("total_years_experience", data.total_years_experience);
      addField("citizenship_number", data.citizenship_number);
      addField("citizenship_issued_date", data.citizenship_issued_date);
      addField("citizenship_issued_district", data.citizenship_issued_district);
      addField("passport_number", data.passport_number);
      addField("passport_expiry_date", data.passport_expiry_date);
      addField("pan_number", data.pan_number);
      addField("national_id_number", data.national_id_number);
      addField("bank_name", data.bank_name);
      addField("bank_branch", data.bank_branch);
      addField("account_number", data.account_number);
      addField("account_holder_name", data.account_holder_name);
      addField("salary_grade", data.salary_grade);
      addField("basic_salary", data.basic_salary);
      addField("allowances", data.allowances, true);
      addField("provident_fund_number", data.provident_fund_number);
      addField("insurance_number", data.insurance_number);
      addField("emergency_contact_name", data.emergency_contact_name);
      addField(
        "emergency_contact_relationship",
        data.emergency_contact_relationship,
      );
      addField("emergency_contact_phone", data.emergency_contact_phone);
      addField("emergency_contact_address", data.emergency_contact_address);
      addField("documents", data.documents, true);
      addField("is_active", data.is_active);

      if (fields.length === 0) {
        return this.getTeacher(id, req);
      }

      const query = `UPDATE teachers SET ${fields.join(", ")}, updated_at = CURRENT_TIMESTAMP WHERE id = $${idx} RETURNING *`;
      values.push(id);

      console.log(
        "[TeacherService Update] Final payload.documents before update:",
        data.documents,
      );
      const result = await pool.query(query, values);
      console.log(
        "[TeacherService Update] Updated teacher:",
        result.rows[0]?.id,
        "documents count:",
        result.rows[0]?.documents?.length || 0,
      );
      return result.rows[0] || null;
    } catch (err) {
      throw new Error(`Failed to update teacher ${id}: ${err.message}`);
    }
  };

  deleteTeacher = async (id, req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
      await this.ensureTable(pool);
      const query = `DELETE FROM teachers WHERE id = $1 RETURNING id`;
      const result = await pool.query(query, [id]);
      return result.rows[0] || null;
    } catch (err) {
      throw new Error(`Failed to delete teacher ${id}: ${err.message}`);
    }
  };

  _computeYears = (fromDate, toDate) => {
    if (!fromDate || !toDate) return null;
    const from = new Date(fromDate);
    const to = new Date(toDate);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from)
      return null;
    const diff = to.getTime() - from.getTime();
    return Number((diff / (1000 * 60 * 60 * 24 * 365)).toFixed(2));
  };
}

module.exports = new TeacherService();
