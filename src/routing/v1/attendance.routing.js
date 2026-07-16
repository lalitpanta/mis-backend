const express = require('express');
const AttendanceController = require('../../controller/attendance.controller');
const router = express.Router();

// Get attendance for a date (type=teacher|employee optional)
router.get('/', AttendanceController.getAttendance);
// Summary
router.get('/summary', AttendanceController.getSummary);
// History
router.get('/history', AttendanceController.getHistory);

module.exports = router;
