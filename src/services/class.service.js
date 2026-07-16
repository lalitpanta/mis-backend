class ClassService {
  ensure = async (pool) => {
    const sql = `
      CREATE TABLE IF NOT EXISTS classes (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        code VARCHAR(50),
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS sections (
        id SERIAL PRIMARY KEY,
        class_id INT REFERENCES classes(id) ON DELETE CASCADE,
        name VARCHAR(50) NOT NULL,
        code VARCHAR(50),
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await pool.query(sql);
  };

  listClasses = async (req) => {
    try {
      const pool = req?.tenantPool || require('../config/db');
      await this.ensure(pool);
      const res = await pool.query('SELECT * FROM classes ORDER BY name');
      return res.rows;
    } catch (err) { throw new Error(`Failed to list classes: ${err.message}`); }
  };

  createClass = async (data, req) => {
    try {
      const pool = req?.tenantPool || require('../config/db');
      await this.ensure(pool);
      const res = await pool.query('INSERT INTO classes (name, code, is_active) VALUES ($1,$2,$3) RETURNING *', [data.name, data.code||null, data.is_active===undefined?true:data.is_active]);
      return res.rows[0];
    } catch (err) { throw new Error(`Failed to create class: ${err.message}`); }
  };

  listSections = async (req) => {
    try {
      const pool = req?.tenantPool || require('../config/db');
      await this.ensure(pool);
      const res = await pool.query('SELECT * FROM sections ORDER BY name');
      return res.rows;
    } catch (err) { throw new Error(`Failed to list sections: ${err.message}`); }
  };

  createSection = async (data, req) => {
    try {
      const pool = req?.tenantPool || require('../config/db');
      await this.ensure(pool);
      const res = await pool.query('INSERT INTO sections (class_id, name, code, is_active) VALUES ($1,$2,$3,$4) RETURNING *', [data.class_id, data.name, data.code||null, data.is_active===undefined?true:data.is_active]);
      return res.rows[0];
    } catch (err) { throw new Error(`Failed to create section: ${err.message}`); }
  };
}

module.exports = new ClassService();
