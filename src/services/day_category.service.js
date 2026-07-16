const { getTenantPool } = require("../config/tenantDb");

class DayCategoryService {
  /**
   * Get all day categories
   */
  async getAllCategories(yearId, req) {
    try {
      const pool = req?.tenantPool || require("../config/db");
      let query = 'SELECT * FROM "day_category" ORDER BY category_name ASC';
      let values = [];

      if (yearId) {
        query = `
          SELECT dc.*, COALESCE(SUM(stats.total_days), 0) as total_days
          FROM "day_category" dc
          LEFT JOIN "day_category_yearly_stats" stats ON dc.id = stats.category_id AND stats.year_id = $1
          GROUP BY dc.id
          ORDER BY dc.category_name ASC
        `;
        values = [yearId];
      }

      const result = await pool.query(query, values);
      return result.rows;
    } catch (err) {
      throw new Error(`Failed to fetch day categories: ${err.message}`);
    }
  }

  /**
   * Create or update a day category
   */
  async createCategory(categoryName, req) {
    try {
      const pool = req?.tenantPool || require("../config/db");
      const query = `
        INSERT INTO "day_category" (category_name)
        VALUES ($1)
        ON CONFLICT (category_name) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `;
      const result = await pool.query(query, [categoryName]);
      return result.rows[0];
    } catch (err) {
      throw new Error(`Failed to create/update day category: ${err.message}`);
    }
  }

  /**
   * Update a day category label
   */
  async updateCategory(id, categoryName, req) {
    try {
      const pool = req?.tenantPool || require("../config/db");
      const query = `
        UPDATE "day_category"
        SET category_name = $2, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *
      `;
      const result = await pool.query(query, [id, categoryName]);
      return result.rows[0];
    } catch (err) {
      throw new Error(`Failed to update day category: ${err.message}`);
    }
  }

  /**
   * Delete a day category
   */
  async deleteCategory(id, req) {
    try {
      const pool = req?.tenantPool || require("../config/db");
      const query = 'DELETE FROM "day_category" WHERE id = $1 RETURNING *';
      const result = await pool.query(query, [id]);
      return result.rows[0];
    } catch (err) {
      throw new Error(`Failed to delete day category: ${err.message}`);
    }
  }
}

module.exports = new DayCategoryService();
