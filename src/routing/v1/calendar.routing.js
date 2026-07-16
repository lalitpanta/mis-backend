const calendarCTRL = require("../../controller/calendar.controller");

const calendarRoute = require("express").Router();

// Generic endpoints with date_format parameter
// Get calendar for a month (linear view)
calendarRoute.get("/month", calendarCTRL.getMonthCalendar);

// Get calendar for a month (grouped by weeks view - better for UI)
calendarRoute.get("/month/weeks", calendarCTRL.getMonthCalendarByWeeks);

// Dedicated BS (Bikram Sambat) endpoints
// Get calendar in BS - Linear view
calendarRoute.get("/bs/month", calendarCTRL.getMonthCalendarBS);

// Get calendar in BS - Grouped by weeks
calendarRoute.get("/bs/weeks", calendarCTRL.getMonthCalendarByWeeksBS);

// Dedicated AD (Anno Domini) endpoints
// Get calendar in AD - Linear view
calendarRoute.get("/ad/month", calendarCTRL.getMonthCalendarAD);

// Get calendar in AD - Grouped by weeks
calendarRoute.get("/ad/weeks", calendarCTRL.getMonthCalendarByWeeksAD);

module.exports = calendarRoute;
