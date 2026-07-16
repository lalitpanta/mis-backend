const { getTenantPool } = require("../config/tenantDb");

class DayClassificationService {
  /**
   * Create day classification
   */
  uploadDay = async (dayData, req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
      const query =
        'INSERT INTO "day_classification" (day_type, category_id) VALUES ($1, $2) RETURNING *';
      const values = [dayData.day_type, dayData.category_id];
      const result = await pool.query(query, values);
      return result.rows[0];
    } catch (err) {
      throw new Error(`Failed to upload day classification: ${err.message}`);
    }
  };

  /**
   * Get all day classifications
   */
  getAllDays = async (req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
      const query = `
        SELECT dc.*, cat.category_name 
        FROM "day_classification" dc
        LEFT JOIN "day_category" cat ON dc.category_id = cat.id
        ORDER BY dc.created_at DESC
      `;
      const result = await pool.query(query);
      return result.rows;
    } catch (err) {
      throw new Error(`Failed to fetch day classifications: ${err.message}`);
    }
  };

  /**
   * Get day classification by ID
   */
  getDayById = async (dayId, req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
      const query = `
        SELECT dc.*, cat.category_name 
        FROM "day_classification" dc
        LEFT JOIN "day_category" cat ON dc.category_id = cat.id
        WHERE dc.id = $1
      `;
      const result = await pool.query(query, [dayId]);
      return result.rows[0] || null;
    } catch (err) {
      throw new Error(`Failed to fetch day classification: ${err.message}`);
    }
  };

  /**
   * Update day classification
   */
  updateDay = async (dayId, updateData, req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
      const query =
        'UPDATE "day_classification" SET day_type = COALESCE($1, day_type), category_id = COALESCE($2, category_id), updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *';
      const values = [updateData.day_type, updateData.category_id, dayId];
      const result = await pool.query(query, values);
      return result.rows[0] || null;
    } catch (err) {
      throw new Error(`Failed to update day classification: ${err.message}`);
    }
  };

  /**
   * Delete day classification
   */
  deleteDay = async (dayId, req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
      const query =
        'DELETE FROM "day_classification" WHERE id = $1 RETURNING *';
      const values = [dayId];
      const result = await pool.query(query, values);
      return result.rows[0] || null;
    } catch (err) {
      throw new Error(`Failed to delete day classification: ${err.message}`);
    }
  };
}

const dayClassificationService = new DayClassificationService();
module.exports = dayClassificationService;
