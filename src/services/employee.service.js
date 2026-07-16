const { v4: uuidv4 } = require("uuid");

class EmployeeService {
  ensureTable = async (pool) => {
    try {
      await pool.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
    } catch (err) {
      // ignore extension creation errors
    }

    const createTableSql = `
      CREATE TABLE IF NOT EXISTS employees (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID,
        employee_id VARCHAR(100) UNIQUE NOT NULL,
        full_name VARCHAR(255) NOT NULL,
        full_name_nepali VARCHAR(255),
        gender VARCHAR(50),
        date_of_birth DATE,
        marital_status VARCHAR(100),
        nationality VARCHAR(100),
        blood_group VARCHAR(50),
        mobile_number VARCHAR(100),
        email_address VARCHAR(255),
        permanent_address TEXT,
        temporary_address TEXT,
        emergency_contact_name VARCHAR(255),
        emergency_contact_phone VARCHAR(100),
        emergency_contact_relationship VARCHAR(100),
        photograph_url TEXT,
        citizenship_number VARCHAR(255),
        citizenship_issued_district VARCHAR(100),
        passport_number VARCHAR(255),
        driving_license_number VARCHAR(255),
        pan_number VARCHAR(255),
        date_of_joining DATE,
        employee_status VARCHAR(100),
        department_id UUID,
        designation VARCHAR(100),
        branch_office VARCHAR(100),
        reporting_supervisor VARCHAR(255),
        grade_level VARCHAR(100),
        employment_type VARCHAR(100),
        confirmation_date DATE,
        transfer_history JSONB DEFAULT '[]'::jsonb,
        promotion_history JSONB DEFAULT '[]'::jsonb,
        basic_salary NUMERIC,
        dearness_allowance NUMERIC,
        other_allowances JSONB DEFAULT '{}'::jsonb,
        gross_salary NUMERIC,
        bank_account_number VARCHAR(255),
        bank_name VARCHAR(255),
        bank_branch VARCHAR(255),
        ssf_number VARCHAR(255),
        cit_number VARCHAR(255),
        tax_deduction NUMERIC,
        ssf_contribution NUMERIC,
        net_salary NUMERIC,
        academic_qualification VARCHAR(255),
        university_board VARCHAR(255),
        passed_year VARCHAR(50),
        major_subject VARCHAR(255),
        percentage_cgpa VARCHAR(50),
        documents JSONB DEFAULT '[]'::jsonb,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await pool.query(createTableSql);

    // Ensure documents column exists (for backward compatibility)
    try {
      await pool.query(`
        ALTER TABLE employees
        ADD COLUMN IF NOT EXISTS documents JSONB DEFAULT '[]'::jsonb;
      `);
    } catch (err) {
      console.log("[EmployeeService] documents column check:", err.message);
    }
  };

  listEmployees = async (req, filters = {}) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
      await this.ensureTable(pool);

      const conditions = ["employees.is_active = TRUE"];
      const values = [];
      let idx = 1;

      // Permission filtering:
      // - system_admin, tenant, and staff can view all employees
      // - teacher and student users can only view their own record
      if (req && req.user) {
        const t = req.user.type;
        if (t === "teacher" || t === "student") {
          conditions.push(`employees.id = $${idx++}`);
          values.push(req.user.id);
        }
      }

      if (filters.department_id) {
        conditions.push(`employees.department_id = $${idx++}`);
        values.push(filters.department_id);
      }
      if (filters.designation) {
        conditions.push(`employees.designation ILIKE $${idx++}`);
        values.push(`%${filters.designation}%`);
      }
      if (filters.search) {
        conditions.push(`employees.full_name ILIKE $${idx++}`);
        values.push(`%${filters.search}%`);
      }

      const query = `
        SELECT employees.*, d.name AS department_name
        FROM employees
        LEFT JOIN departments d ON employees.department_id = d.id
        ${conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""}
        ORDER BY employees.created_at DESC
      `;

      console.log("[EmployeeService] listEmployees query:", query);
      console.log("[EmployeeService] listEmployees values:", values);

      const result = await pool.query(query, values);
      console.log(
        "[EmployeeService] listEmployees result rows:",
        result.rows.length,
      );

      return result.rows;
    } catch (err) {
      console.error("[EmployeeService] listEmployees error:", err.message);
      throw new Error(`Failed to list employees: ${err.message}`);
    }
  };

  listEmployeeOptions = async (req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
      await this.ensureTable(pool);
      const query = `
        SELECT id, employee_id, full_name, email_address, mobile_number, department_id, designation
        FROM employees
        WHERE is_active = TRUE
        ORDER BY full_name
      `;
      const result = await pool.query(query);
      return result.rows;
    } catch (err) {
      throw new Error(`Failed to fetch employee options: ${err.message}`);
    }
  };

  getEmployee = async (id, req) => {
    try {
      // Permission check:
      // - system_admin, tenant, and staff can view any employee
      // - teacher and student can only view their own record
      if (req && req.user) {
        const t = req.user.type;
        if ((t === "teacher" || t === "student") && req.user.id !== id) {
          return null;
        }
      }

      const pool = req?.tenantPool || require("../config/db");
      await this.ensureTable(pool);
      const query = `SELECT * FROM employees WHERE id = $1`;
      const result = await pool.query(query, [id]);
      return result.rows[0] || null;
    } catch (err) {
      throw new Error(`Failed to fetch employee ${id}: ${err.message}`);
    }
  };

  createEmployee = async (data, req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
      await this.ensureTable(pool);

      const id = uuidv4();
      const query = `
        INSERT INTO employees (
          id, user_id, employee_id, full_name, full_name_nepali, gender, date_of_birth,
          marital_status, nationality, blood_group, mobile_number, email_address,
          permanent_address, temporary_address, emergency_contact_name,
          emergency_contact_phone, emergency_contact_relationship, photograph_url,
          citizenship_number, citizenship_issued_district, passport_number,
          driving_license_number, pan_number, date_of_joining, employee_status,
          department_id, designation, branch_office, reporting_supervisor,
          grade_level, employment_type, confirmation_date, transfer_history,
          promotion_history, basic_salary, dearness_allowance, other_allowances,
          gross_salary, bank_account_number, bank_name, bank_branch, ssf_number,
          cit_number, tax_deduction, ssf_contribution, net_salary,
          academic_qualification, university_board, passed_year, major_subject,
          percentage_cgpa, documents
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18,
          $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34,
          $35, $36, $37, $38, $39, $40, $41, $42, $43, $44, $45, $46, $47, $48, $49, $50, $51, $52
        ) RETURNING *
      `;

      const values = [
        id,
        data.user_id || null,
        data.employee_id,
        data.full_name,
        data.full_name_nepali,
        data.gender,
        data.date_of_birth,
        data.marital_status,
        data.nationality,
        data.blood_group,
        data.mobile_number,
        data.email_address,
        data.permanent_address,
        data.temporary_address,
        data.emergency_contact_name,
        data.emergency_contact_phone,
        data.emergency_contact_relationship,
        data.photograph_url,
        data.citizenship_number,
        data.citizenship_issued_district,
        data.passport_number,
        data.driving_license_number,
        data.pan_number,
        data.date_of_joining,
        data.employee_status,
        data.department_id,
        data.designation,
        data.branch_office,
        data.reporting_supervisor,
        data.grade_level,
        data.employment_type,
        data.confirmation_date,
        JSON.stringify(data.transfer_history || []),
        JSON.stringify(data.promotion_history || []),
        data.basic_salary,
        data.dearness_allowance,
        JSON.stringify(data.other_allowances || {}),
        data.gross_salary,
        data.bank_account_number,
        data.bank_name,
        data.bank_branch,
        data.ssf_number,
        data.cit_number,
        data.tax_deduction,
        data.ssf_contribution,
        data.net_salary,
        data.academic_qualification,
        data.university_board,
        data.passed_year,
        data.major_subject,
        data.percentage_cgpa,
        JSON.stringify(data.documents || []),
      ];

      const result = await pool.query(query, values);
      return result.rows[0];
    } catch (err) {
      throw new Error(`Failed to create employee: ${err.message}`);
    }
  };

  updateEmployee = async (id, data, req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
      await this.ensureTable(pool);

      const updates = [];
      const values = [];
      let idx = 1;

      const fieldMap = {
        full_name: "full_name",
        full_name_nepali: "full_name_nepali",
        gender: "gender",
        date_of_birth: "date_of_birth",
        marital_status: "marital_status",
        nationality: "nationality",
        blood_group: "blood_group",
        mobile_number: "mobile_number",
        email_address: "email_address",
        permanent_address: "permanent_address",
        temporary_address: "temporary_address",
        emergency_contact_name: "emergency_contact_name",
        emergency_contact_phone: "emergency_contact_phone",
        emergency_contact_relationship: "emergency_contact_relationship",
        photograph_url: "photograph_url",
        citizenship_number: "citizenship_number",
        citizenship_issued_district: "citizenship_issued_district",
        passport_number: "passport_number",
        driving_license_number: "driving_license_number",
        pan_number: "pan_number",
        date_of_joining: "date_of_joining",
        employee_status: "employee_status",
        department_id: "department_id",
        designation: "designation",
        branch_office: "branch_office",
        reporting_supervisor: "reporting_supervisor",
        grade_level: "grade_level",
        employment_type: "employment_type",
        confirmation_date: "confirmation_date",
        transfer_history: "transfer_history",
        promotion_history: "promotion_history",
        basic_salary: "basic_salary",
        dearness_allowance: "dearness_allowance",
        other_allowances: "other_allowances",
        gross_salary: "gross_salary",
        bank_account_number: "bank_account_number",
        bank_name: "bank_name",
        bank_branch: "bank_branch",
        ssf_number: "ssf_number",
        cit_number: "cit_number",
        tax_deduction: "tax_deduction",
        ssf_contribution: "ssf_contribution",
        net_salary: "net_salary",
        academic_qualification: "academic_qualification",
        university_board: "university_board",
        passed_year: "passed_year",
        major_subject: "major_subject",
        percentage_cgpa: "percentage_cgpa",
        documents: "documents",
      };

      for (const [key, dbField] of Object.entries(fieldMap)) {
        if (key in data && data[key] !== undefined) {
          const isJson = [
            "transfer_history",
            "promotion_history",
            "other_allowances",
            "documents",
          ].includes(dbField);
          updates.push(`${dbField} = $${idx++}`);
          values.push(isJson ? JSON.stringify(data[key]) : data[key]);
        }
      }

      if (updates.length === 0) {
        return await this.getEmployee(id, req);
      }

      updates.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(id);

      const query = `UPDATE employees SET ${updates.join(", ")} WHERE id = $${idx} RETURNING *`;
      const result = await pool.query(query, values);
      return result.rows[0] || null;
    } catch (err) {
      throw new Error(`Failed to update employee: ${err.message}`);
    }
  };

  deleteEmployee = async (id, req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
      const query = `DELETE FROM employees WHERE id = $1 RETURNING *`;
      const result = await pool.query(query, [id]);
      return result.rows[0] || null;
    } catch (err) {
      throw new Error(`Failed to delete employee: ${err.message}`);
    }
  };
}

module.exports = new EmployeeService();
