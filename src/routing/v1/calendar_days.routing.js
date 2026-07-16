const calendarDaysCTRL = require("../../controller/calendar_days.controller");

const calendarDaysRoute = require("express").Router();

// ⚠️ IMPORTANT: Specific routes MUST come before generic /:id routes!

// Generate calendar days for a month
calendarDaysRoute.post("/generate", calendarDaysCTRL.generateCalendarDays);

// Get calendar days for a month with dates and day types
calendarDaysRoute.get("/month", calendarDaysCTRL.getCalendarDays);

// Get calendar days for a year
calendarDaysRoute.get("/year/:year_id", calendarDaysCTRL.getCalendarDaysByYear);

// Get available day types for UI
calendarDaysRoute.get(
  "/day-types/available",
  calendarDaysCTRL.getAvailableDayTypes,
);

// Manually assign day types by day_number (EASY FOR USERS!)
calendarDaysRoute.post("/manual-assign", calendarDaysCTRL.manualAssignDayTypes);

// Bulk assign day types to multiple calendar days
calendarDaysRoute.post("/bulk-assign", calendarDaysCTRL.bulkAssignDayTypes);

// Assign day type to all days with specific weekday in a month or year
// MUST be before /:id routes to match correctly
calendarDaysRoute.post(
  "/assign-by-weekday",
  calendarDaysCTRL.assignDayTypeByWeekday,
);

// Refresh yearly category stats
// MUST be before /:id routes
calendarDaysRoute.post("/refresh-stats/:year_id", calendarDaysCTRL.refreshYearlyStats);

// ⚠️ Generic /:id routes MUST come last
// Assign day type to a specific calendar day
calendarDaysRoute.patch("/:id/assign-type", calendarDaysCTRL.assignDayType);

// Get specific calendar day
calendarDaysRoute.get("/:id", calendarDaysCTRL.getCalendarDay);

// Delete calendar day
calendarDaysRoute.delete("/:id", calendarDaysCTRL.deleteCalendarDay);

module.exports = calendarDaysRoute;
