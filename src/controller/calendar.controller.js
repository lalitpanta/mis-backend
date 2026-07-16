const calendarService = require("../services/calendar.service");

class CalendarController {
  /**
   * Get calendar for a specific month
   * Query params: year_label, month_name, date_format (BS or AD)
   */
  getMonthCalendar = async (req, res, next) => {
    try {
      const { year_label, month_name, date_format = "BS" } = req.query;

      // Validate required params
      if (!year_label || !month_name) {
        return res.status(400).json({
          error: "year_label and month_name are required",
        });
      }

      // Validate date_format
      if (!["BS", "AD"].includes(date_format)) {
        return res.status(400).json({
          error: "date_format must be 'BS' or 'AD'",
        });
      }

      const calendar = await calendarService.generateMonthCalendar(
        year_label,
        month_name,
        date_format,
        req,
      );

      return res.status(200).json({
        message: "Calendar generated successfully",
        data: calendar,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Get calendar grouped by weeks (better for UI display)
   * Query params: year_label, month_name, date_format (BS or AD)
   */
  getMonthCalendarByWeeks = async (req, res, next) => {
    try {
      const { year_label, month_name, date_format = "BS" } = req.query;

      // Validate required params
      if (!year_label || !month_name) {
        return res.status(400).json({
          error: "year_label and month_name are required",
        });
      }

      // Validate date_format
      if (!["BS", "AD"].includes(date_format)) {
        return res.status(400).json({
          error: "date_format must be 'BS' or 'AD'",
        });
      }

      const calendar = await calendarService.getCalendarGroupedByWeeks(
        year_label,
        month_name,
        date_format,
        req,
      );

      return res.status(200).json({
        message: "Calendar generated successfully (grouped by weeks)",
        data: calendar,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Get calendar in Bikram Sambat (BS) - Linear View
   * Query params: year_label, month_name
   */
  getMonthCalendarBS = async (req, res, next) => {
    try {
      const { year_label, month_name } = req.query;

      if (!year_label || !month_name) {
        return res.status(400).json({
          error: "year_label and month_name are required",
        });
      }

      const calendar = await calendarService.generateMonthCalendar(
        year_label,
        month_name,
        date_format,
        req,
      );

      return res.status(200).json({
        message: "Calendar generated successfully in BS format",
        data: calendar,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Get calendar in Anno Domini (AD) - Linear View
   * Query params: year_label, month_name
   */
  getMonthCalendarAD = async (req, res, next) => {
    try {
      const { year_label, month_name } = req.query;

      if (!year_label || !month_name) {
        return res.status(400).json({
          error: "year_label and month_name are required",
        });
      }

      const calendar = await calendarService.generateMonthCalendar(
        year_label,
        month_name,
        "AD",
        req,
      );

      return res.status(200).json({
        message: "Calendar generated successfully in AD format",
        data: calendar,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Get calendar in Bikram Sambat (BS) - Grouped by Weeks
   * Query params: year_label, month_name
   */
  getMonthCalendarByWeeksBS = async (req, res, next) => {
    try {
      const { year_label, month_name } = req.query;

      if (!year_label || !month_name) {
        return res.status(400).json({
          error: "year_label and month_name are required",
        });
      }

      const calendar = await calendarService.getCalendarGroupedByWeeks(
        year_label,
        month_name,
        "BS",
      );

      return res.status(200).json({
        message:
          "Calendar generated successfully in BS format (grouped by weeks)",
        data: calendar,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Get calendar in Anno Domini (AD) - Grouped by Weeks
   * Query params: year_label, month_name
   */
  getMonthCalendarByWeeksAD = async (req, res, next) => {
    try {
      const { year_label, month_name } = req.query;

      if (!year_label || !month_name) {
        return res.status(400).json({
          error: "year_label and month_name are required",
        });
      }

      const calendar = await calendarService.getCalendarGroupedByWeeks(
        year_label,
        month_name,
        "AD",
      );

      return res.status(200).json({
        message:
          "Calendar generated successfully in AD format (grouped by weeks)",
        data: calendar,
      });
    } catch (err) {
      next(err);
    }
  };
}

const calendarCTRL = new CalendarController();
module.exports = calendarCTRL;
