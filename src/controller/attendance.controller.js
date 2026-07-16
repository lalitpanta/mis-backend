const AttendanceService = require('../services/attendance.service');

class AttendanceController {
  static async getAttendance(req, res, next) {
    try {
      const pool = req.tenantPool;
      const tenantId = req.tenantId;
      const { date, type } = req.query;
      const rows = await AttendanceService.getAttendance(pool, tenantId, { date, userType: type });
      res.json({ success: true, data: rows });
    } catch (err) {
      next(err);
    }
  }

  static async getHistory(req, res, next) {
    try {
      const pool = req.tenantPool;
      const tenantId = req.tenantId;
      const { userId, startDate, endDate } = req.query;
      const rows = await AttendanceService.getAttendanceHistory(pool, tenantId, { userId, startDate, endDate });
      res.json({ success: true, data: rows });
    } catch (err) {
      next(err);
    }
  }

  static async getSummary(req, res, next) {
    try {
      const pool = req.tenantPool;
      const tenantId = req.tenantId;
      const { date, type } = req.query;
      const summary = await AttendanceService.getSummary(pool, tenantId, { date, userType: type });
      res.json({ success: true, data: summary });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = AttendanceController;
