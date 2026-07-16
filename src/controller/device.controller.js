const DeviceService = require('../services/device.service');

class DeviceController {
  /**
   * Create new device
   */
  static createDevice = async (req, res, next) => {
    try {
      const { device_name, device_type, ip_address, port, location, connection_method, pull_interval_minutes } = req.body;
      const tenantId = req.tenantId;
      const pool = req.tenantPool;

      if (!device_name || !device_type || !ip_address) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const result = await pool.query(
        `INSERT INTO devices (tenant_id, device_name, device_type, ip_address, port, location, connection_method, pull_interval_minutes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [tenantId, device_name, device_type, ip_address, port || 5000, location, connection_method || 'pull', pull_interval_minutes || 5]
      );

      res.status(201).json({ success: true, device: result.rows[0] });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get all devices for tenant
   */
  static listDevices = async (req, res, next) => {
    try {
      const tenantId = req.tenantId;
      const pool = req.tenantPool;

      const result = await pool.query(
        'SELECT * FROM devices WHERE tenant_id = $1 ORDER BY created_at DESC',
        [tenantId]
      );

      res.json({ success: true, devices: result.rows });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get device by ID
   */
  static getDevice = async (req, res, next) => {
    try {
      const { deviceId } = req.params;
      const tenantId = req.tenantId;
      const pool = req.tenantPool;

      const result = await pool.query(
        'SELECT * FROM devices WHERE id = $1 AND tenant_id = $2',
        [deviceId, tenantId]
      );

      if (result.rows.length === 0) return res.status(404).json({ error: 'Device not found' });

      res.json({ success: true, device: result.rows[0] });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Update device
   */
  static updateDevice = async (req, res, next) => {
    try {
      const { deviceId } = req.params;
      const tenantId = req.tenantId;
      const pool = req.tenantPool;
      const updates = req.body;

      // Build dynamic update query
      const updateKeys = Object.keys(updates).filter(k => k !== 'id' && k !== 'tenant_id' && k !== 'created_at');
      if (updateKeys.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }

      const setClause = updateKeys.map((key, i) => `${key} = $${i + 1}`).join(', ');
      const values = updateKeys.map(key => updates[key]);
      values.push(deviceId, tenantId);

      const result = await pool.query(
        `UPDATE devices SET ${setClause}, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $${updateKeys.length + 1} AND tenant_id = $${updateKeys.length + 2}
         RETURNING *`,
        values
      );

      if (result.rows.length === 0) return res.status(404).json({ error: 'Device not found' });

      res.json({ success: true, device: result.rows[0] });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Delete device
   */
  static deleteDevice = async (req, res, next) => {
    try {
      const { deviceId } = req.params;
      const tenantId = req.tenantId;
      const pool = req.tenantPool;

      const result = await pool.query(
        'DELETE FROM devices WHERE id = $1 AND tenant_id = $2 RETURNING id',
        [deviceId, tenantId]
      );

      if (result.rows.length === 0) return res.status(404).json({ error: 'Device not found' });

      res.json({ success: true, message: 'Device deleted' });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Test device connection
   */
  static testConnection = async (req, res, next) => {
    try {
      const { deviceId } = req.params;
      const tenantId = req.tenantId;
      const pool = req.tenantPool;

      const deviceResult = await pool.query(
        'SELECT * FROM devices WHERE id = $1 AND tenant_id = $2',
        [deviceId, tenantId]
      );

      if (deviceResult.rows.length === 0) return res.status(404).json({ error: 'Device not found' });

      const device = deviceResult.rows[0];
      const result = await DeviceService.testDeviceConnection(device);
      await DeviceService.updateDeviceStatus(pool, tenantId, deviceId);

      res.json({ success: result.success, ...result });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Manual sync now
   */
  static syncNow = async (req, res, next) => {
    try {
      const { deviceId } = req.params;
      const tenantId = req.tenantId;
      const pool = req.tenantPool;

      const result = await DeviceService.syncNow(pool, tenantId, parseInt(deviceId));
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get sync logs
   */
  static getSyncLogs = async (req, res, next) => {
    try {
      const { deviceId } = req.params;
      const { page = 1, limit = 10 } = req.query;
      const tenantId = req.tenantId;
      const pool = req.tenantPool;

      const offset = (parseInt(page) - 1) * parseInt(limit);
      const countResult = await pool.query(
        'SELECT COUNT(*) FROM device_sync_logs WHERE tenant_id = $1 AND device_id = $2',
        [tenantId, deviceId]
      );

      const logsResult = await pool.query(
        `SELECT * FROM device_sync_logs WHERE tenant_id = $1 AND device_id = $2
         ORDER BY created_at DESC LIMIT $3 OFFSET $4`,
        [tenantId, deviceId, parseInt(limit), offset]
      );

      const total = parseInt(countResult.rows[0].count);
      res.json({
        success: true,
        logs: logsResult.rows,
        total,
        pages: Math.ceil(total / parseInt(limit)),
        currentPage: parseInt(page)
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Enroll teachers on device
   */
  static enrollTeachers = async (req, res, next) => {
    try {
      const { deviceId } = req.params;
      const tenantId = req.tenantId;
      const pool = req.tenantPool;

      const result = await DeviceService.enrollTeachersOnDevice(pool, tenantId, parseInt(deviceId));
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get teacher enrollments for device
   */
  static getEnrollments = async (req, res, next) => {
    try {
      const { deviceId } = req.params;
      const tenantId = req.tenantId;
      const pool = req.tenantPool;

      const result = await pool.query(
        `SELECT dte.*, tu.first_name, tu.last_name FROM device_teacher_enrollments dte
         LEFT JOIN tenant_users tu ON dte.user_id = tu.id
         WHERE dte.tenant_id = $1 AND dte.device_id = $2`,
        [tenantId, deviceId]
      );

      res.json({ success: true, enrollments: result.rows });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get unmatched device IDs
   */
  static getUnmatchedIds = async (req, res, next) => {
    try {
      const { deviceId } = req.params;
      const tenantId = req.tenantId;
      const pool = req.tenantPool;

      const result = await pool.query(
        `SELECT * FROM unmatched_device_ids WHERE tenant_id = $1 AND device_id = $2
         ORDER BY last_seen_at DESC`,
        [tenantId, deviceId]
      );

      res.json({ success: true, unmatched: result.rows });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get attendance records
   */
  static getAttendanceRecords = async (req, res, next) => {
    try {
      const { deviceId } = req.params;
      const { page = 1, limit = 50, status } = req.query;
      const tenantId = req.tenantId;
      const pool = req.tenantPool;

      const offset = (parseInt(page) - 1) * parseInt(limit);
      
      let query = 'SELECT * FROM device_attendance_records WHERE tenant_id = $1 AND device_id = $2';
      let params = [tenantId, deviceId];
      
      if (status) {
        query += ` AND attendance_status = $${params.length + 1}`;
        params.push(status);
      }

      const countResult = await pool.query(
        `SELECT COUNT(*) FROM device_attendance_records WHERE tenant_id = $1 AND device_id = $2 ${status ? `AND attendance_status = $3` : ''}`,
        params.length > 2 ? params : [tenantId, deviceId]
      );

      query += ` ORDER BY punch_time DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(parseInt(limit), offset);

      const result = await pool.query(query, params);
      const total = parseInt(countResult.rows[0].count);

      res.json({
        success: true,
        records: result.rows,
        total,
        pages: Math.ceil(total / parseInt(limit)),
        currentPage: parseInt(page)
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Manual attendance override
   */
  static overrideAttendance = async (req, res, next) => {
    try {
      const { recordId } = req.params;
      const { status, note } = req.body;
      const tenantId = req.tenantId;
      const pool = req.tenantPool;

      if (!status) return res.status(400).json({ error: 'Status required' });

      const result = await pool.query(
        `UPDATE device_attendance_records 
         SET attendance_status = $1, marked_as = 'manual', manual_override_note = $2
         WHERE id = $3 AND tenant_id = $4
         RETURNING *`,
        [status, note || '', recordId, tenantId]
      );

      if (result.rows.length === 0) return res.status(404).json({ error: 'Record not found' });

      res.json({ success: true, record: result.rows[0] });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get attendance summary
   */
  static getAttendanceSummary = async (req, res, next) => {
    try {
      const { deviceId } = req.params;
      const { date } = req.query;
      const tenantId = req.tenantId;
      const pool = req.tenantPool;

      const queryDate = date ? new Date(date) : new Date();
      const dayStart = new Date(queryDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(queryDate);
      dayEnd.setHours(23, 59, 59, 999);

      const result = await pool.query(
        `SELECT attendance_status, COUNT(*) as count FROM device_attendance_records
         WHERE tenant_id = $1 AND device_id = $2
         AND punch_time BETWEEN $3 AND $4
         GROUP BY attendance_status`,
        [tenantId, deviceId, dayStart, dayEnd]
      );

      res.json({ success: true, date: queryDate, summary: result.rows });
    } catch (error) {
      next(error);
    }
  };
}

module.exports = DeviceController;
