const { getTenantPool } = require("../config/tenantDb");

class YearService {
  /**
   * Create or update year
   */
  uploadYear = async (yearData, req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
      const query = `
        INSERT INTO "year" (
          year_label, year_label_ad, year_label_bs, 
          start_date_ad, end_date_ad, start_date_bs, end_date_bs,
          start_date, end_date, is_current
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (year_label)
        DO UPDATE SET
          year_label_ad = EXCLUDED.year_label_ad,
          year_label_bs = EXCLUDED.year_label_bs,
          start_date_ad = EXCLUDED.start_date_ad,
          end_date_ad   = EXCLUDED.end_date_ad,
          start_date_bs = EXCLUDED.start_date_bs,
          end_date_bs   = EXCLUDED.end_date_bs,
          start_date    = EXCLUDED.start_date,
          end_date      = EXCLUDED.end_date,
          is_current    = EXCLUDED.is_current
        RETURNING *
      `;

      const values = [
        yearData.year_label,
        yearData.year_label_AD,
        yearData.year_label_BS,
        yearData.start_date_AD,
        yearData.end_date_AD,
        yearData.start_date_BS,
        yearData.end_date_BS,
        yearData.start_date_AD || yearData.start_date,
        yearData.end_date_AD   || yearData.end_date,
        yearData.is_current || false
      ];
      const result = await pool.query(query, values);
      const year = result.rows[0];

      if (year && year.is_current) {
        await pool.query('SELECT set_current_year($1)', [year.id]);
        // Refresh the object to reflect DB changes
        const refreshed = await pool.query('SELECT * FROM "year" WHERE id = $1', [year.id]);
        return refreshed.rows[0];
      }

      return year;
    } catch (err) {
      throw new Error(`Failed to upload year: ${err.message}`);
    }
  };

  /**
   * Get all years
   */
  getAllYears = async (req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
      const query = 'SELECT * FROM "year" ORDER BY start_date DESC';
      const result = await pool.query(query);
      return result.rows;
    } catch (err) {
      throw new Error(`Failed to fetch years: ${err.message}`);
    }
  };

  /**
   * Get year by ID
   */
  getYearById = async (yearId, req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
      const query = 'SELECT * FROM "year" WHERE id = $1';
      const result = await pool.query(query, [yearId]);
      return result.rows[0] || null;
    } catch (err) {
      throw new Error(`Failed to fetch year: ${err.message}`);
    }
  };

  /**
   * Get year by label
   */
  getYearByLabel = async (yearLabel, req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
      const query = 'SELECT * FROM "year" WHERE year_label = $1';
      const result = await pool.query(query, [yearLabel]);
      return result.rows[0] || null;
    } catch (err) {
      throw new Error(`Failed to fetch year: ${err.message}`);
    }
  };

  /**
   * Delete year by ID
   */
  deleteYear = async (yearId, req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
      const query = 'DELETE FROM "year" WHERE id = $1 RETURNING *';
      const result = await pool.query(query, [yearId]);
      return result.rows[0] || null;
    } catch (err) {
      throw new Error(`Failed to delete year: ${err.message}`);
    }
  };
}

const yearService = new YearService();
module.exports = yearService;
