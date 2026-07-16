const { getTenantPool } = require("../config/tenantDb");

class DepartmentService {
  // Ensure departments table exists. Attempts to install uuid extension then create table.
  ensureTable = async (pool) => {
    try {
      await pool.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);
    } catch (e) {
      // ignore extension creation errors (may lack permission)
    }
    const createSql = `
      CREATE TABLE IF NOT EXISTS departments (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(255) NOT NULL,
        code VARCHAR(100),
        description TEXT,
        type VARCHAR(50) DEFAULT 'department',
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await pool.query(createSql);
  };

  listDepartments = async (req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
      await this.ensureTable(pool);
      const q = `SELECT id, name, code, description, type, is_active, created_at, updated_at FROM departments ORDER BY name`; 
      const res = await pool.query(q);
      return res.rows;
    } catch (err) {
      throw new Error(`Failed to list departments: ${err.message}`);
    }
  };

  getDepartment = async (id, req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
      await this.ensureTable(pool);
      const q = `SELECT id, name, code, description, type, is_active, created_at, updated_at FROM departments WHERE id = $1`;
      const res = await pool.query(q, [id]);
      return res.rows[0] || null;
    } catch (err) {
      throw new Error(`Failed to fetch department ${id}: ${err.message}`);
    }
  };

  createDepartment = async (data, req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
      await this.ensureTable(pool);
      const q = `INSERT INTO departments (name, code, description, type, is_active) VALUES ($1,$2,$3,$4,$5) RETURNING id, name, code, description, type, is_active, created_at, updated_at`;
      const vals = [data.name, data.code || null, data.description || null, data.type || 'department', data.is_active ?? true];
      const res = await pool.query(q, vals);
      return res.rows[0];
    } catch (err) {
      throw new Error(`Failed to create department: ${err.message}`);
    }
  };

  updateDepartment = async (id, data, req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
      await this.ensureTable(pool);
      const fields = [];
      const values = [];
      let idx = 1;
      if (data.name !== undefined) { fields.push(`name = $${idx++}`); values.push(data.name); }
      if (data.code !== undefined) { fields.push(`code = $${idx++}`); values.push(data.code); }
      if (data.description !== undefined) { fields.push(`description = $${idx++}`); values.push(data.description); }
      if (data.type !== undefined) { fields.push(`type = $${idx++}`); values.push(data.type); }
      if (data.is_active !== undefined) { fields.push(`is_active = $${idx++}`); values.push(data.is_active); }
      if (fields.length === 0) return this.getDepartment(id, req);
      const q = `UPDATE departments SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${idx} RETURNING id, name, code, description, type, is_active, created_at, updated_at`;
      values.push(id);
      const res = await pool.query(q, values);
      return res.rows[0];
    } catch (err) {
      throw new Error(`Failed to update department ${id}: ${err.message}`);
    }
  };

  deleteDepartment = async (id, req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
      await this.ensureTable(pool);
      const q = `DELETE FROM departments WHERE id = $1 RETURNING id`;
      const res = await pool.query(q, [id]);
      return res.rows[0] || null;
    } catch (err) {
      throw new Error(`Failed to delete department ${id}: ${err.message}`);
    }
  };
}

module.exports = new DepartmentService();
