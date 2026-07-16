const { getTenantPool } = require("../config/tenantDb");

class CalendarService {
  /**
   * Generate a complete calendar for a month
   * @param {string} year_label - Year label (e.g., "2080-2081")
   * @param {string} month_name - Month name
   * @param {string} date_format - "BS" or "AD"
   * @returns {Promise} Calendar data with all days and their types
   */
  generateMonthCalendar = async (
    year_label,
    month_name,
    date_format = "BS",
    req,
  ) => {
    try {
      // 1. Fetch year data
      const yearData = await this.getYearData(year_label, req);
      if (!yearData) {
        throw new Error(`Year "${year_label}" not found`);
      }

      // 2. Fetch month data
      const monthData = await this.getMonthData(year_label, month_name, req);
      if (!monthData) {
        throw new Error(
          `Month "${month_name}" not found for year "${year_label}"`,
        );
      }

      // 3. Get day classifications
      const dayClassifications = await this.getDayClassifications(req);

      // 4. Generate calendar dates
      const calendarDates = this.generateDateRange(monthData, date_format);

      // 5. Fetch day types for each date
      const calendarWithTypes = await this.assignDayTypes(
        calendarDates,
        dayClassifications,
      );

      // 6. Format and return calendar
      return {
        year_label: yearData.year_label,
        month_name: monthData.month_name,
        date_format: date_format,
        month_start_date:
          date_format === "BS"
            ? monthData.month_start_date_BS
            : monthData.month_start_date_AD,
        month_end_date:
          date_format === "BS"
            ? monthData.month_end_date_BS
            : monthData.month_end_date_AD,
        start_day:
          date_format === "BS"
            ? monthData.month_start_day_BS
            : monthData.month_start_day_AD,
        calendar: calendarWithTypes,
        total_days: calendarWithTypes.length,
      };
    } catch (err) {
      throw new Error(`Calendar generation failed: ${err.message}`);
    }
  };

  /**
   * Fetch year data from database
   */
  getYearData = async (year_label, req) => {
    const pool = req?.tenantPool || require("../config/db");
    const query = 'SELECT * FROM "year" WHERE year_label = $1';
    const result = await pool.query(query, [year_label]);
    return result.rows[0] || null;
  };

  /**
   * Fetch month data from database
   */
  getMonthData = async (year_label, month_name, req) => {
    const pool = req?.tenantPool || require("../config/db");
    const query = `
      SELECT m.* FROM "month_class_data" m
      JOIN "year" y ON m.year_id = y.id
      WHERE y.year_label = $1 AND m.month_name = $2
    `;
    const result = await pool.query(query, [year_label, month_name]);
    return result.rows[0] || null;
  };

  /**
   * Fetch all day classifications (holiday, working day, etc.)
   */
  getDayClassifications = async (req) => {
    const pool = req?.tenantPool || require("../config/db");
    const query = 'SELECT * FROM "day_classification"';
    const result = await pool.query(query);
    return result.rows;
  };

  /**
   * Generate array of dates for the month
   */
  generateDateRange = (monthData, date_format) => {
    const startDate =
      date_format === "BS"
        ? new Date(monthData.month_start_date_BS)
        : new Date(monthData.month_start_date_AD);
    const endDate =
      date_format === "BS"
        ? new Date(monthData.month_end_date_BS)
        : new Date(monthData.month_end_date_AD);

    const dates = [];
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      dates.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return dates;
  };

  /**
   * Get day of week name (Monday, Tuesday, etc.)
   */
  getDayName = (date) => {
    const days = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];
    return days[date.getDay()];
  };

  /**
   * Assign day types to each calendar date
   * Note: Extend this logic based on your business rules
   */
  assignDayTypes = async (dates, dayClassifications) => {
    return dates.map((date, index) => ({
      date: date.toISOString().split("T")[0], // Format: YYYY-MM-DD
      day_of_week: this.getDayName(date),
      day_number: index + 1, // 1, 2, 3, ... for the month
      day_type: "working_day", // Default - you can customize this based on your logic
      // Example: Check if it's a weekend, holiday, etc.
      // This can be extended with more complex logic
    }));
  };

  /**
   * Get calendar grouped by weeks (for UI display)
   */
  getCalendarGroupedByWeeks = async (
    year_label,
    month_name,
    date_format = "BS",
    req,
  ) => {
    const calendar = await this.generateMonthCalendar(
      year_label,
      month_name,
      date_format,
      req,
    );
    const weeks = [];
    let currentWeek = [];

    // Get starting day offset (e.g., if month starts on Wednesday, add empty days)
    // Get starting day offset using the actual Gregorian start date
    // This ensures the calendar grid always matches real-world dates
    const startDateAD = monthData.month_start_date_AD;
    if (!startDateAD) throw new Error("Month start date (AD) is required for week grouping.");
    
    const startDayObj = new Date(startDateAD);
    const dayIndex = startDayObj.getDay(); // 0 = Sunday, 1 = Monday, etc.

    // Add empty days at the beginning
    for (let i = 0; i < dayIndex; i++) {
      currentWeek.push(null);
    }

    // Add calendar days
    calendar.calendar.forEach((day) => {
      currentWeek.push(day);
      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    });

    // Fill remaining days with null
    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) {
        currentWeek.push(null);
      }
      weeks.push(currentWeek);
    }

    return {
      ...calendar,
      weeks_view: weeks,
    };
  };
}

const calendarService = new CalendarService();
module.exports = calendarService;
