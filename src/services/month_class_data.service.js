const { getTenantPool } = require("../config/tenantDb");

class MonthClassDataService {
  /**
   * Get year ID by year label
   */
  getYearIdByLabel = async (yearLabel, req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
      const query = 'SELECT id FROM "year" WHERE year_label = $1';
      const result = await pool.query(query, [yearLabel]);
      if (result.rows.length === 0) {
        throw new Error(`Year with label "${yearLabel}" not found`);
      }
      return result.rows[0].id;
    } catch (err) {
      throw new Error(err.message);
    }
  };

  /**
   * Create month class data
   */
  uploadMonth = async (monthData, req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
      // Handle year_id - either provided directly or fetched from year_label
      let year_id = monthData.year_id;
      if (!year_id && monthData.year_label) {
        year_id = await this.getYearIdByLabel(monthData.year_label, req);
      }

      if (!year_id) {
        throw new Error('Either year_id or year_label must be provided');
      }

      // Insert month data with year_id and bs_month_index
      const query = `INSERT INTO "month_class_data" (year_id, month_name, bs_month_index, month_start_date_BS, month_end_date_BS, month_start_date_AD, month_end_date_AD, month_start_day_BS, month_end_day_BS, month_start_day_AD, month_end_day_AD, date_format) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`;
      const values = [
        year_id,
        monthData.month_name,
        monthData.bs_month_index || null,
        monthData.month_start_date_BS,
        monthData.month_end_date_BS,
        monthData.month_start_date_AD,
        monthData.month_end_date_AD,
        monthData.month_start_day_BS,
        monthData.month_end_day_BS,
        monthData.month_start_day_AD,
        monthData.month_end_day_AD,
        monthData.date_format || 'BS',
      ];
      const result = await pool.query(query, values);
      return result.rows[0];
    } catch (err) {
      throw new Error(`Failed to upload month: ${err.message}`);
    }
  };

  /**
   * Get all months
   */
  getAllMonths = async (req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
      const query = 'SELECT * FROM "month_class_data" ORDER BY created_at DESC';
      const result = await pool.query(query);
      return result.rows;
    } catch (err) {
      throw new Error(`Failed to fetch months: ${err.message}`);
    }
  };

  /**
   * Get month by ID
   */
  getMonthById = async (monthId, req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
      const query = 'SELECT * FROM "month_class_data" WHERE id = $1';
      const result = await pool.query(query, [monthId]);
      return result.rows[0] || null;
    } catch (err) {
      throw new Error(`Failed to fetch month: ${err.message}`);
    }
  };

  /**
   * Update month class data (Dynamic Update)
   */
  updateMonth = async (monthId, updateData, req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
      // 1. Fetch current data to preserve year_id if not changed
      const current = await this.getMonthById(monthId, req);
      if (!current) return null;

      let year_id = current.year_id;
      if (updateData.year_id) {
        year_id = updateData.year_id;
      } else if (updateData.year_label) {
        year_id = await this.getYearIdByLabel(updateData.year_label, req);
      }

      // 2. Build dynamic query
      const fields = [];
      const values = [];
      let idx = 1;

      // Map year_id explicitly
      fields.push(`year_id = $${idx++}`);
      values.push(year_id);

      const allowedFields = [
        'month_name',
        'bs_month_index',
        'month_start_date_BS', 'month_end_date_BS',
        'month_start_date_AD', 'month_end_date_AD',
        'month_start_day_BS', 'month_end_day_BS',
        'month_start_day_AD', 'month_end_day_AD',
        'date_format'
      ];

      for (const field of allowedFields) {
        if (updateData[field] !== undefined) {
          fields.push(`${field} = $${idx++}`);
          values.push(updateData[field]);
        }
      }

      values.push(monthId);
      const query = `
        UPDATE "month_class_data" 
        SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP 
        WHERE id = $${idx} 
        RETURNING *
      `;

      const result = await pool.query(query, values);
      return result.rows[0] || null;
    } catch (err) {
      throw new Error(`Failed to update month: ${err.message}`);
    }
  };

  /**
   * Delete month
   */
  deleteMonth = async (monthId, req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
      const query = 'DELETE FROM "month_class_data" WHERE id = $1 RETURNING *';
      const result = await pool.query(query, [monthId]);
      return result.rows[0] || null;
    } catch (err) {
      throw new Error(`Failed to delete month: ${err.message}`);
    }
  };

  /**
   * Generate calendar days for a month (auto-generation)
   */
  generateCalendarDaysForMonth = async (monthId, monthData, req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
      // Postgres returns lowercase column names
      const startAdStr = String(monthData.month_start_date_ad || monthData.month_start_date_AD);
      const endAdStr = String(monthData.month_end_date_ad || monthData.month_end_date_AD);
      const dateFormat = String(monthData.date_format || 'BS').toUpperCase();
      const startDayName = String(
        dateFormat === 'AD'
          ? (monthData.month_start_day_ad || monthData.month_start_day_AD || monthData.month_start_day_bs || monthData.month_start_day_BS)
          : (monthData.month_start_day_bs || monthData.month_start_day_BS || monthData.month_start_day_ad || monthData.month_start_day_AD)
      );
      const yearId = monthData.year_id;
      
      const days = [];
      const dayNames = [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ];

      const startAd = new Date(startAdStr);
      const endAd = new Date(endAdStr);
      const numDays = Math.round((endAd - startAd) / (1000 * 60 * 60 * 24)) + 1;


      let currentDayIndex = dayNames.indexOf(startDayName);
      if (currentDayIndex === -1 && !Number.isNaN(startAd.getTime())) {
        currentDayIndex = startAd.getDay();
      }
      if (currentDayIndex === -1) currentDayIndex = 0;

      for (let i = 0; i < numDays; i++) {
        days.push({
          yearId,
          monthId,
          dayNumber: i + 1,
          dayOfWeek: dayNames[currentDayIndex % 7],
        });
        currentDayIndex++;
      }

      // Batch insert all days
      if (days.length === 0) {
        return [];
      }

      const values = [];
      const placeholders = [];
      let paramIndex = 1;

      days.forEach((day) => {
        placeholders.push(
          `($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3})`,
        );
        values.push(day.yearId, day.monthId, day.dayNumber, day.dayOfWeek);
        paramIndex += 4;
      });

      const query = `
        INSERT INTO "calendar_days" (year_id, month_id, day_number, day_of_week)
        VALUES ${placeholders.join(", ")}
        RETURNING *
      `;

      const result = await pool.query(query, values);
      return result.rows;
    } catch (err) {
      throw new Error(`Failed to generate calendar days: ${err.message}`);
    }
  };

  /**
   * Regenerate calendar days for a month (delete old, create new)
   * Called when month dates/days are updated
   */
  regenerateCalendarDaysForMonth = async (monthId, monthData, req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
      // 1. Delete old calendar days
      const deleteQuery = 'DELETE FROM "calendar_days" WHERE month_id = $1';
      await pool.query(deleteQuery, [monthId]);

      // 2. Generate new calendar days
      const newCalendarDays = await this.generateCalendarDaysForMonth(
        monthId,
        monthData,
        req,
      );

      return newCalendarDays;
    } catch (err) {
      throw new Error(`Failed to regenerate calendar days: ${err.message}`);
    }
  };
}

const monthClassDataService = new MonthClassDataService();
module.exports = monthClassDataService;
