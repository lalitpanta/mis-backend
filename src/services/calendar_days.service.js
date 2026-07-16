const { getTenantPool } = require("../config/tenantDb");

class CalendarDaysService {
  /**
   * Generate calendar days for a month
   * Creates entries for each day with day_of_week
   */
  generateCalendarDays = async (monthId, monthData, req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
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

      // Use the actual Gregorian start date to determine the correct starting weekday index
      // This prevents conflicts between UI labels and real calendar logic
      const startDateAD = monthData.month_start_date_AD || monthData.month_start_date_ad || monthData.start_date;
      if (!startDateAD) throw new Error("Month start date (AD) is required to calculate weekdays.");
      
      const startDayObj = new Date(startDateAD);
      let currentDayIndex = startDayObj.getDay(); // 0 = Sunday, 1 = Monday, etc.

      // Use Gregorian dates to calculate the total number of days in the month
      // This is much more robust than splitting BS date strings
      const startAdStr = monthData.month_start_date_AD || monthData.month_start_date_ad || monthData.start_date;
      const endAdStr = monthData.month_end_date_AD || monthData.month_end_date_ad || monthData.end_date;
      
      if (!startAdStr || !endAdStr) {
        throw new Error("Both start and end dates (AD) are required to generate calendar days.");
      }

      const startAd = new Date(startAdStr);
      const endAd = new Date(endAdStr);
      const numDays = Math.round((endAd - startAd) / (1000 * 60 * 60 * 24)) + 1;

      if (isNaN(numDays) || numDays <= 0 || numDays > 32) {
        throw new Error(`Invalid date range calculated: ${numDays} days. Check start/end dates.`);
      }

      for (let i = 0; i < numDays; i++) {
        days.push({
          yearId: monthData.year_id,
          monthId,
          dayNumber: i + 1,
          dayOfWeek: dayNames[currentDayIndex % 7],
        });
        currentDayIndex++;
      }

      // Delete existing days for this month first to avoid duplicates
      await this.deleteCalendarDaysByMonth(monthId, req);

      // Insert all days in batch
      return this.batchInsertCalendarDays(days, req);
    } catch (err) {
      throw new Error(`Failed to generate calendar days: ${err.message}`);
    }
  };

  /**
   * Batch insert calendar days
   */
  batchInsertCalendarDays = async (days, req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
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
      throw new Error(`Failed to batch insert calendar days: ${err.message}`);
    }
  };

  /**
   * Get all calendar days for a specific month
   */
  getCalendarDaysByMonth = async (monthId, req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
      const query = `
        SELECT cd.*, dc.day_type, cat.category_name
        FROM "calendar_days" cd
        LEFT JOIN "day_classification" dc ON cd.day_type_id = dc.id
        LEFT JOIN "day_category" cat ON dc.category_id = cat.id
        WHERE cd.month_id = $1
        ORDER BY cd.day_number ASC
      `;
      const result = await pool.query(query, [monthId]);
      return result.rows;
    } catch (err) {
      throw new Error(`Failed to fetch calendar days: ${err.message}`);
    }
  };

  /**
   * Assign day type to a specific calendar day
   */
  assignDayType = async (calendarDayId, dayTypeId, req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
      const query = `
        UPDATE "calendar_days"
        SET day_type_id = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING *
      `;
      const result = await pool.query(query, [dayTypeId, calendarDayId]);
      const updatedDay = result.rows[0];
      
      if (updatedDay) {
        // Refresh the pre-calculated yearly stats
        await pool.query('SELECT refresh_year_category_stats($1)', [updatedDay.year_id])
          .catch(e => console.error("Stats refresh failed", e));
      }
      
      return updatedDay || null;
    } catch (err) {
      throw new Error(`Failed to assign day type: ${err.message}`);
    }
  };

  /**
   * Bulk assign day types to multiple calendar days
   * Example: [{ calendarDayId: "xxx", dayTypeId: "yyy" }, ...]
   */
  bulkAssignDayTypes = async (assignments, req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
      if (assignments.length === 0) {
        return [];
      }

      const results = [];
      for (const { calendarDayId, dayTypeId } of assignments) {
        // Use direct query instead of calling this.assignDayType multiple times to avoid redundant refreshes
        const query = `
          UPDATE "calendar_days"
          SET day_type_id = $1, updated_at = CURRENT_TIMESTAMP
          WHERE id = $2
          RETURNING *
        `;
        const result = await pool.query(query, [dayTypeId, calendarDayId]);
        if (result.rows[0]) results.push(result.rows[0]);
      }

      // Refresh stats once at the end for the whole year
      if (results.length > 0) {
         await pool.query('SELECT refresh_year_category_stats($1)', [results[0].year_id])
           .catch(e => console.error("Stats refresh failed", e));
      }

      return results;
    } catch (err) {
      throw new Error(`Failed to bulk assign day types: ${err.message}`);
    }
  };

  /**
   * Get calendar day by ID with details
   */
  getCalendarDayById = async (calendarDayId, req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
      const query = `
        SELECT cd.*, dc.day_type
        FROM "calendar_days" cd
        LEFT JOIN "day_classification" dc ON cd.day_type_id = dc.id
        WHERE cd.id = $1
      `;
      const result = await pool.query(query, [calendarDayId]);
      return result.rows[0] || null;
    } catch (err) {
      throw new Error(`Failed to fetch calendar day: ${err.message}`);
    }
  };

  /**
   * Delete calendar days for a month (when deleting month)
   */
  deleteCalendarDaysByMonth = async (monthId, req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
      const query = 'DELETE FROM "calendar_days" WHERE month_id = $1';
      await pool.query(query, [monthId]);
    } catch (err) {
      throw new Error(`Failed to delete calendar days: ${err.message}`);
    }
  };

  /**
   * Delete a specific calendar day
   */
  deleteCalendarDay = async (calendarDayId, req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
      const query = 'DELETE FROM "calendar_days" WHERE id = $1 RETURNING *';
      const result = await pool.query(query, [calendarDayId]);
      return result.rows[0] || null;
    } catch (err) {
      throw new Error(`Failed to delete calendar day: ${err.message}`);
    }
  };

  /**
   * Get calendar with dates (joins with month_class_data to calculate actual dates)
   */
  getCalendarWithDates = async (monthId, dateFormat = "BS", req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
      const query = `
        SELECT 
          cd.id,
          cd.day_number,
          cd.day_of_week,
          dc.day_type,
          cat.category_name,
          mc.month_name,
          CASE 
            WHEN $2 = 'BS' THEN 
              substring(mc.month_start_date_BS from 1 for 8) || LPAD((substring(mc.month_start_date_BS from 9 for 2)::integer + cd.day_number - 1)::text, 2, '0')
            ELSE 
              TO_CHAR((mc.month_start_date_AD::DATE + (cd.day_number - 1)::integer * INTERVAL '1 day')::DATE, 'YYYY-MM-DD')
          END as date,
          dc.id as day_type_id
        FROM "calendar_days" cd
        LEFT JOIN "day_classification" dc ON cd.day_type_id = dc.id
        LEFT JOIN "day_category" cat ON dc.category_id = cat.id
        JOIN "month_class_data" mc ON cd.month_id = mc.id
        WHERE cd.month_id = $1
        ORDER BY cd.day_number ASC
      `;
      // UUID validation for monthId
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (monthId === 'whole_year' || !uuidRegex.test(monthId)) {
        return [];
      }

      const result = await pool.query(query, [monthId, dateFormat]);
      return result.rows;
    } catch (err) {
      throw new Error(`Failed to fetch calendar with dates: ${err.message}`);
    }
  };

  /**
   * Assign multiple day types by day_of_week
   * Example: Assign "holiday" to all Sundays and Saturdays in a month
   * 
   * @param {string} monthId - UUID of the month (null for year-wide assignment)
   * @param {string} yearId - UUID of the year (null for month-specific assignment)
   * @param {string} dayOfWeek - Day name (e.g., "Sunday", "Monday")
   * @param {string} dayTypeId - UUID of the day type to assign
   * @param {object} req - Request object with tenantPool
   * 
   * IMPORTANT: Either monthId or yearId must be provided, not both.
   * - If monthId is provided, assigns to all matching days in that month
   * - If yearId is provided (and monthId is null/undefined), assigns to all matching days in all months of that year
   */
  assignDayTypeByDayOfWeek = async (monthId, yearId, dayOfWeek, dayTypeId, req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
      let query;
      let values;

      // Use monthId if provided (month-level assignment)
      if (monthId && monthId !== null) {
        query = `
          UPDATE "calendar_days"
          SET day_type_id = $1, updated_at = CURRENT_TIMESTAMP
          WHERE month_id = $2 AND day_of_week = $3
          RETURNING *
        `;
        values = [dayTypeId, monthId, dayOfWeek];
      } 
      // Otherwise use yearId for year-level assignment
      else if (yearId && yearId !== null) {
        query = `
          UPDATE "calendar_days"
          SET day_type_id = $1, updated_at = CURRENT_TIMESTAMP
          WHERE month_id IN (
            SELECT id FROM "month_class_data" WHERE year_id = $2
          ) AND day_of_week = $3
          RETURNING *
        `;
        values = [dayTypeId, yearId, dayOfWeek];
      } 
      // Neither provided - this shouldn't happen due to controller validation, but guard anyway
      else {
        throw new Error('Either monthId or yearId must be provided for weekday assignment');
      }

      const result = await pool.query(query, values);
      return result.rows;
    } catch (err) {
      throw new Error(
        `Failed to assign day type by day of week: ${err.message}`,
      );
    }
  };

  /**
   * Manually assign day types by day_number
   * User provides: month_id and array of { day_number, day_type_id }
   * Example: [ { day_number: 1, day_type_id: "xxx" }, { day_number: 3, day_type_id: "yyy" } ]
   */
  manualAssignDayTypes = async (monthId, assignments, req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
      if (!Array.isArray(assignments) || assignments.length === 0) {
        throw new Error("Assignments must be a non-empty array");
      }

      const results = [];

      for (const assignment of assignments) {
        const { day_number, day_type_id } = assignment;

        if (!day_number || !day_type_id) {
          throw new Error(
            "Each assignment must have day_number and day_type_id",
          );
        }

        // Find calendar_day by month_id and day_number, then update it
        const query = `
          UPDATE "calendar_days"
          SET day_type_id = $1, updated_at = CURRENT_TIMESTAMP
          WHERE month_id = $2 AND day_number = $3
          RETURNING *
        `;

        const result = await pool.query(query, [
          day_type_id,
          monthId,
          day_number,
        ]);

        if (result.rows.length === 0) {
          throw new Error(`Day ${day_number} not found in month ${monthId}`);
        }

        results.push(result.rows[0]);
      }

      return results;
    } catch (err) {
      throw new Error(`Failed to manually assign day types: ${err.message}`);
    }
  };

  /**
   * Get available day_types for a month (for UI dropdown)
   */
  getAvailableDayTypes = async (req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
      const query =
        'SELECT id, day_type FROM "day_classification" ORDER BY day_type ASC';
      const result = await pool.query(query);
      return result.rows;
    } catch (err) {
      throw new Error(`Failed to fetch day types: ${err.message}`);
    }
  };
  /**
   * Refresh yearly category stats in database
   */
  refreshYearlyStats = async (yearId, req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
      await pool.query('SELECT refresh_year_category_stats($1)', [yearId]);
    } catch (err) {
      throw new Error(`Failed to refresh yearly stats: ${err.message}`);
    }
  };

  /**
   * Get all calendar days for a specific year
   */
  getCalendarDaysByYear = async (yearId, req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
      const query = `
        SELECT cd.*, dc.day_type, cat.category_name, mc.month_name
        FROM "calendar_days" cd
        LEFT JOIN "day_classification" dc ON cd.day_type_id = dc.id
        LEFT JOIN "day_category" cat ON dc.category_id = cat.id
        JOIN "month_class_data" mc ON cd.month_id = mc.id
        WHERE cd.year_id = $1
        ORDER BY mc.created_at ASC, cd.day_number ASC
      `;
      const result = await pool.query(query, [yearId]);
      return result.rows;
    } catch (err) {
      throw new Error(`Failed to fetch calendar days for year: ${err.message}`);
    }
  };
}

const calendarDaysService = new CalendarDaysService();
module.exports = calendarDaysService;
