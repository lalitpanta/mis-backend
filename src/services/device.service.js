const axios = require('axios');

class DeviceService {
  /**
   * Test device connection
   */
  static async testDeviceConnection(device) {
    try {
      const url = `http://${device.ip_address}:${device.port}/api/test`;
      const response = await axios.get(url, { timeout: 5000 });
      return { success: true, message: 'Device is reachable', status: 'online' };
    } catch (error) {
      return { 
        success: false, 
        message: error.message, 
        status: error.response ? 'offline' : 'unreachable' 
      };
    }
  }

  /**
   * Update device connection status
   */
  static async updateDeviceStatus(pool, tenantId, deviceId) {
    try {
      const deviceResult = await pool.query(
        'SELECT * FROM devices WHERE id = $1 AND tenant_id = $2',
        [deviceId, tenantId]
      );
      
      if (deviceResult.rows.length === 0) return false;
      
      const device = deviceResult.rows[0];
      const result = await this.testDeviceConnection(device);
      
      await pool.query(
        'UPDATE devices SET connection_status = $1, last_status_check_at = CURRENT_TIMESTAMP WHERE id = $2',
        [result.status, deviceId]
      );
      
      return result.status === 'online';
    } catch (error) {
      console.error('Error updating device status:', error);
      return false;
    }
  }

  /**
   * Fetch attendance records from device
   */
  static async pullAttendanceFromDevice(device, pool, tenantId) {
    try {
      const url = `http://${device.ip_address}:${device.port}/api/attendance?pull_interval=${device.pull_interval_minutes}`;
      const response = await axios.get(url, { timeout: 30000 });
      
      const records = response.data.records || [];
      
      const syncResult = await pool.query(
        `INSERT INTO device_sync_logs 
         (tenant_id, device_id, sync_type, status, records_pulled)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [tenantId, device.id, 'auto', 'success', records.length]
      );

      return { success: true, records, syncLogId: syncResult.rows[0].id };
    } catch (error) {
      await pool.query(
        `INSERT INTO device_sync_logs 
         (tenant_id, device_id, sync_type, status, error_message)
         VALUES ($1, $2, $3, $4, $5)`,
        [tenantId, device.id, 'auto', 'failed', error.message]
      );
      throw error;
    }
  }

  /**
   * Process attendance records
   */
  static async processAttendanceRecords(pool, tenantId, deviceId, records, syncLogId) {
    let saved = 0, skipped = 0;

    for (const record of records) {
      try {
        // Check for duplicate within 60 seconds
        const recentPunchResult = await pool.query(
          `SELECT id FROM device_attendance_records 
           WHERE device_id = $1 AND device_user_id = $2 
           AND punch_time BETWEEN $3::timestamp - interval '60 seconds' 
           AND $3::timestamp + interval '60 seconds'
           LIMIT 1`,
          [deviceId, record.user_id, record.punch_time]
        );

        if (recentPunchResult.rows.length > 0) {
          skipped++;
          continue;
        }

        // Determine late status (after 10:10 AM Nepal time)
        const punchTime = new Date(record.punch_time);
        const nplTime = new Date(punchTime.toLocaleString('en-US', { timeZone: 'Asia/Kathmandu' }));
        const attendanceStatus = (nplTime.getHours() > 10 || 
                                 (nplTime.getHours() === 10 && nplTime.getMinutes() > 10))
                                ? 'late' : 'present';

        // Check for enrollment
        const enrollmentResult = await pool.query(
          `SELECT user_id FROM device_teacher_enrollments 
           WHERE device_id = $1 AND device_user_id = $2 AND enrollment_status = 'enrolled'`,
          [deviceId, record.user_id]
        );

        const userId = enrollmentResult.rows.length > 0 ? enrollmentResult.rows[0].user_id : null;

        // Insert attendance record
        await pool.query(
          `INSERT INTO device_attendance_records 
           (tenant_id, device_id, user_id, device_user_id, punch_time, attendance_status, synced_from_device, synced_at)
           VALUES ($1, $2, $3, $4, $5, $6, true, CURRENT_TIMESTAMP)`,
          [tenantId, deviceId, userId, record.user_id, punchTime, attendanceStatus]
        );

        // Track unmatched if no enrollment
        if (!userId) {
          const unmatchedResult = await pool.query(
            `SELECT id, punch_count FROM unmatched_device_ids 
             WHERE device_id = $1 AND device_user_id = $2`,
            [deviceId, record.user_id]
          );

          if (unmatchedResult.rows.length > 0) {
            await pool.query(
              `UPDATE unmatched_device_ids 
               SET last_seen_at = CURRENT_TIMESTAMP, punch_count = punch_count + 1
               WHERE id = $1`,
              [unmatchedResult.rows[0].id]
            );
          } else {
            await pool.query(
              `INSERT INTO unmatched_device_ids (tenant_id, device_id, device_user_id, punch_count)
               VALUES ($1, $2, $3, 1)`,
              [tenantId, deviceId, record.user_id]
            );
          }
        }

        saved++;
      } catch (error) {
        console.error('Error processing record:', error);
        skipped++;
      }
    }

    // Update sync log
    await pool.query(
      `UPDATE device_sync_logs 
       SET records_saved = $1, records_skipped = $2, completed_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [saved, skipped, syncLogId]
    );

    return { saved, skipped };
  }

  /**
   * Perform manual sync
   */
  static async syncNow(pool, tenantId, deviceId) {
    try {
      const deviceResult = await pool.query(
        'SELECT * FROM devices WHERE id = $1 AND tenant_id = $2',
        [deviceId, tenantId]
      );
      
      if (deviceResult.rows.length === 0) throw new Error('Device not found');
      
      const device = deviceResult.rows[0];
      const isOnline = await this.updateDeviceStatus(pool, tenantId, deviceId);
      if (!isOnline) throw new Error('Device is not reachable');

      const { records, syncLogId } = await this.pullAttendanceFromDevice(device, pool, tenantId);
      const processResult = await this.processAttendanceRecords(pool, tenantId, deviceId, records, syncLogId);

      await pool.query(
        'UPDATE devices SET last_synced_at = CURRENT_TIMESTAMP WHERE id = $1',
        [deviceId]
      );

      return { success: true, syncLogId, ...processResult };
    } catch (error) {
      console.error('Sync error:', error);
      throw error;
    }
  }

  /**
   * Enroll teachers on device
   */
  static async enrollTeachersOnDevice(pool, tenantId, deviceId) {
    try {
      const deviceResult = await pool.query(
        'SELECT * FROM devices WHERE id = $1 AND tenant_id = $2',
        [deviceId, tenantId]
      );
      
      if (deviceResult.rows.length === 0) throw new Error('Device not found');
      
      const device = deviceResult.rows[0];

      // Get all teachers (users with teacher role)
      const teachersResult = await pool.query(
        `SELECT DISTINCT u.id, u.first_name, u.last_name FROM tenant_users u
         INNER JOIN user_roles ur ON u.id = ur.user_id
         INNER JOIN roles r ON ur.role_id = r.id
         WHERE r.role_name = 'teacher'`
      );

      const enrollmentData = teachersResult.rows.map(teacher => ({
        user_id: teacher.id,
        device_user_id: teacher.id.toString()
      }));

      // Push to device API
      const url = `http://${device.ip_address}:${device.port}/api/enroll`;
      await axios.post(url, { users: enrollmentData }, { timeout: 30000 });

      // Mark as enrolled
      for (const data of enrollmentData) {
        await pool.query(
          `INSERT INTO device_teacher_enrollments 
           (tenant_id, device_id, user_id, device_user_id, enrollment_status, enrolled_at)
           VALUES ($1, $2, $3, $4, 'enrolled', CURRENT_TIMESTAMP)
           ON CONFLICT (device_id, user_id) DO UPDATE 
           SET enrollment_status = 'enrolled', enrolled_at = CURRENT_TIMESTAMP`,
          [tenantId, deviceId, data.user_id, data.device_user_id]
        );
      }

      return { success: true, enrolled: enrollmentData.length };
    } catch (error) {
      console.error('Enrollment error:', error);
      throw error;
    }
  }
}

module.exports = DeviceService;
