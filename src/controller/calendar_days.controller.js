const calendarDaysService = require("../services/calendar_days.service");
const monthClassDataService = require("../services/month_class_data.service");

class CalendarDaysController {
  /**
   * Generate calendar days for a month
   * POST /api/calendar-days/generate?month_id=xxx
   */
  generateCalendarDays = async (req, res, next) => {
    try {
      const { month_id } = req.query;

      if (!month_id) {
        return res.status(400).json({
          error: "month_id is required",
        });
      }

      // Fetch month data to get start/end dates
      const monthData = await monthClassDataService.getMonthById(month_id, req);
      if (!monthData) {
        return res.status(404).json({
          error: "Month not found",
        });
      }

      // Generate calendar days
      const calendarDays = await calendarDaysService.generateCalendarDays(
        month_id,
        monthData,
        req
      );

      return res.status(201).json({
        message: `Generated ${calendarDays.length} calendar days for month`,
        data: calendarDays,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Get calendar days for a month with day types
   * GET /api/calendar-days/month?month_id=xxx&date_format=BS
   */
  getCalendarDays = async (req, res, next) => {
    try {
      const { month_id, date_format = "BS" } = req.query;

      if (!month_id) {
        return res.status(400).json({
          error: "month_id is required",
        });
      }

      // Get calendar with calculated dates
      const calendarDays = await calendarDaysService.getCalendarWithDates(
        month_id,
        date_format,
        req
      );

      if (calendarDays.length === 0) {
        return res.status(404).json({
          error: "No calendar days found for this month",
        });
      }

      return res.status(200).json({
        message: "Calendar days retrieved successfully",
        data: calendarDays,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Assign day type to a specific calendar day
   * PATCH /api/calendar-days/:id/assign-type
   * Body: { day_type_id: "xxx" }
   */
  assignDayType = async (req, res, next) => {
    try {
      const { id } = req.params;
      const { day_type_id } = req.body;

      if (day_type_id === undefined) {
        return res.status(400).json({
          error: "day_type_id is required (can be null)",
        });
      }

      const result = await calendarDaysService.assignDayType(id, day_type_id, req);

      if (!result) {
        return res.status(404).json({
          error: "Calendar day not found",
        });
      }

      return res.status(200).json({
        message: "Day type assigned successfully",
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Bulk assign day types to multiple calendar days
   * POST /api/calendar-days/bulk-assign
   * Body: { assignments: [{ calendarDayId: "xxx", dayTypeId: "yyy" }, ...] }
   */
  bulkAssignDayTypes = async (req, res, next) => {
    try {
      const { assignments } = req.body;

      if (
        !assignments ||
        !Array.isArray(assignments) ||
        assignments.length === 0
      ) {
        return res.status(400).json({
          error: "assignments array is required with at least one item",
        });
      }

      const results = await calendarDaysService.bulkAssignDayTypes(assignments, req);

      return res.status(200).json({
        message: `Assigned day types to ${results.length} calendar days`,
        data: results,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Assign day type to all days with specific day_of_week in a month or year
   * POST /api/calendar-days/assign-by-weekday
   * Body: { month_id: "xxx" OR year_id: "xxx", day_of_week: "Sunday", day_type_id: "yyy" }
   * 
   * Priority: month_id takes precedence over year_id
   */
  assignDayTypeByWeekday = async (req, res, next) => {
    try {
      const { month_id, year_id, day_of_week, day_type_id } = req.body;

      // Validate required fields
      if (!day_of_week || !day_type_id) {
        return res.status(400).json({
          error: "day_of_week and day_type_id are required",
        });
      }
      
      // Either month_id or year_id must be provided (month_id takes priority)
      if (!month_id && !year_id) {
        return res.status(400).json({
          error: "Either month_id or year_id must be provided",
        });
      }

      // Validate day_of_week
      const validDays = [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ];
      if (!validDays.includes(day_of_week)) {
        return res.status(400).json({
          error: `day_of_week must be one of: ${validDays.join(", ")}`,
        });
      }

      // Call service with explicit null handling
      const results = await calendarDaysService.assignDayTypeByDayOfWeek(
        month_id || null,  // Explicitly pass null if not provided
        year_id || null,   // Explicitly pass null if not provided
        day_of_week,
        day_type_id,
        req
      );

      return res.status(200).json({
        message: `Successfully assigned day type to ${results.length} ${day_of_week}(s)`,
        count: results.length,
        data: results,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Get a specific calendar day with details
   * GET /api/calendar-days/:id
   */
  getCalendarDay = async (req, res, next) => {
    try {
      const { id } = req.params;

      const result = await calendarDaysService.getCalendarDayById(id, req);

      if (!result) {
        return res.status(404).json({
          error: "Calendar day not found",
        });
      }

      return res.status(200).json({
        message: "Calendar day retrieved successfully",
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Delete a specific calendar day
   * DELETE /api/calendar-days/:id
   */
  deleteCalendarDay = async (req, res, next) => {
    try {
      const { id } = req.params;

      const result = await calendarDaysService.deleteCalendarDay(id, req);

      if (!result) {
        return res.status(404).json({
          error: "Calendar day not found",
        });
      }

      return res.status(200).json({
        message: "Calendar day deleted successfully",
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Manually assign day types by day_number
   * POST /api/calendar-days/manual-assign
   * Body: {
   *   "month_id": "month-123",
   *   "assignments": [
   *     { "day_number": 1, "day_type_id": "type-1" },
   *     { "day_number": 3, "day_type_id": "type-2" },
   *     { "day_number": 5, "day_type_id": "type-3" }
   *   ]
   * }
   */
  manualAssignDayTypes = async (req, res, next) => {
    try {
      const { month_id, assignments } = req.body;

      if (!month_id) {
        return res.status(400).json({
          error: "month_id is required",
        });
      }

      if (
        !assignments ||
        !Array.isArray(assignments) ||
        assignments.length === 0
      ) {
        return res.status(400).json({
          error:
            "assignments array is required with at least one item. Format: [{ day_number: 1, day_type_id: 'xxx' }, ...]",
        });
      }

      const results = await calendarDaysService.manualAssignDayTypes(
        month_id,
        assignments,
        req,
      );

      return res.status(200).json({
        message: `Successfully assigned day types to ${results.length} days`,
        data: results,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Get available day types for UI dropdown
   * GET /api/calendar-days/day-types/available
   */
  getAvailableDayTypes = async (req, res, next) => {
    try {
      const results = await calendarDaysService.getAvailableDayTypes(req);

      return res.status(200).json({
        message: "Available day types retrieved successfully",
        data: results,
      });
    } catch (err) {
      next(err);
    }
  };
  /**
   * Get calendar days for a year
   * GET /api/calendar-days/year/:year_id
   */
  getCalendarDaysByYear = async (req, res, next) => {
    try {
      const { year_id } = req.params;

      if (!year_id) {
        return res.status(400).json({
          error: "year_id is required",
        });
      }

      const calendarDays = await calendarDaysService.getCalendarDaysByYear(year_id, req);

      return res.status(200).json({
        message: "Calendar days for year retrieved successfully",
        data: calendarDays,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Refresh yearly category stats
   * POST /api/calendar-days/refresh-stats/:year_id
   */
  refreshYearlyStats = async (req, res, next) => {
    try {
      const { year_id } = req.params;
      await calendarDaysService.refreshYearlyStats(year_id, req);
      return res.status(200).json({
        message: "Yearly stats refreshed successfully",
      });
    } catch (err) {
      next(err);
    }
  };
}

const calendarDaysCTRL = new CalendarDaysController();
module.exports = calendarDaysCTRL;
