class AttendanceService {
  async getAttendance(pool, tenantId, { date = null, userType = null } = {}) {
    const targetDate = date || new Date().toISOString().slice(0, 10);
    const params = [tenantId, targetDate];
    let userQuery = '';

    if (userType === 'teacher') {
      userQuery = `
        SELECT
          t.id AS user_id,
          t.employee_id AS external_id,
          t.full_name AS name,
          t.designation,
          d.name AS department,
          'teacher' AS user_type,
          MIN(dar.punch_time) FILTER (WHERE dar.punch_type = 'in') AS check_in,
          MAX(dar.punch_time) FILTER (WHERE dar.punch_type = 'out') AS check_out,
          MAX(dar.device_id) AS device_id,
          MAX(dar.device_user_id) AS device_user_id,
          COALESCE(MAX(dar.attendance_status), 'absent') AS status
        FROM teachers t
        LEFT JOIN departments d ON t.department_id = d.id
        LEFT JOIN device_teacher_enrollments e ON e.user_id = t.id AND e.tenant_id = $1
        LEFT JOIN device_attendance_records dar ON dar.tenant_id = $1 AND dar.device_user_id = e.device_user_id AND DATE(dar.punch_time) = $2
        WHERE t.is_active = TRUE
        GROUP BY t.id, t.employee_id, t.full_name, t.designation, d.name
        ORDER BY t.full_name ASC
      `;
    } else if (userType === 'employee') {
      userQuery = `
        SELECT
          emp.id AS user_id,
          emp.employee_id AS external_id,
          emp.full_name AS name,
          emp.designation,
          d.name AS department,
          'employee' AS user_type,
          MIN(dar.punch_time) FILTER (WHERE dar.punch_type = 'in') AS check_in,
          MAX(dar.punch_time) FILTER (WHERE dar.punch_type = 'out') AS check_out,
          MAX(dar.device_id) AS device_id,
          MAX(dar.device_user_id) AS device_user_id,
          COALESCE(MAX(dar.attendance_status), 'absent') AS status
        FROM employees emp
        LEFT JOIN departments d ON emp.department_id = d.id
        LEFT JOIN device_teacher_enrollments e ON e.user_id = emp.id AND e.tenant_id = $1
        LEFT JOIN device_attendance_records dar ON dar.tenant_id = $1 AND dar.device_user_id = e.device_user_id AND DATE(dar.punch_time) = $2
        WHERE emp.is_active = TRUE
        GROUP BY emp.id, emp.employee_id, emp.full_name, emp.designation, d.name
        ORDER BY emp.full_name ASC
      `;
    } else {
      userQuery = `
        SELECT * FROM (
          SELECT
            t.id AS user_id,
            t.employee_id AS external_id,
            t.full_name AS name,
            t.designation,
            d.name AS department,
            'teacher' AS user_type,
            MIN(dar.punch_time) FILTER (WHERE dar.punch_type = 'in') AS check_in,
            MAX(dar.punch_time) FILTER (WHERE dar.punch_type = 'out') AS check_out,
            MAX(dar.device_id) AS device_id,
            MAX(dar.device_user_id) AS device_user_id,
            COALESCE(MAX(dar.attendance_status), 'absent') AS status
          FROM teachers t
          LEFT JOIN departments d ON t.department_id = d.id
          LEFT JOIN device_teacher_enrollments e ON e.user_id = t.id AND e.tenant_id = $1
          LEFT JOIN device_attendance_records dar ON dar.tenant_id = $1 AND dar.device_user_id = e.device_user_id AND DATE(dar.punch_time) = $2
          WHERE t.is_active = TRUE
          GROUP BY t.id, t.employee_id, t.full_name, t.designation, d.name

          UNION ALL

          SELECT
            emp.id AS user_id,
            emp.employee_id AS external_id,
            emp.full_name AS name,
            emp.designation,
            d.name AS department,
            'employee' AS user_type,
            MIN(dar.punch_time) FILTER (WHERE dar.punch_type = 'in') AS check_in,
            MAX(dar.punch_time) FILTER (WHERE dar.punch_type = 'out') AS check_out,
            MAX(dar.device_id) AS device_id,
            MAX(dar.device_user_id) AS device_user_id,
            COALESCE(MAX(dar.attendance_status), 'absent') AS status
          FROM employees emp
          LEFT JOIN departments d ON emp.department_id = d.id
          LEFT JOIN device_teacher_enrollments e ON e.user_id = emp.id AND e.tenant_id = $1
          LEFT JOIN device_attendance_records dar ON dar.tenant_id = $1 AND dar.device_user_id = e.device_user_id AND DATE(dar.punch_time) = $2
          WHERE emp.is_active = TRUE
          GROUP BY emp.id, emp.employee_id, emp.full_name, emp.designation, d.name
        ) full_list
        ORDER BY name ASC
      `;
    }

    const res = await pool.query(userQuery, params);
    return res.rows.map((row) => ({
      ...row,
      status: row.status || 'absent',
      check_in: row.check_in ? row.check_in.toISOString() : null,
      check_out: row.check_out ? row.check_out.toISOString() : null,
    }));
  }

  async getAttendanceHistory(pool, tenantId, { userId = null, userType = null, startDate = null, endDate = null } = {}) {
    const params = [tenantId];
    let idx = 2;
    const filters = [`dar.tenant_id = $1`];
    let typeFilter = '';

    if (startDate) {
      filters.push(`DATE(dar.punch_time) >= $${idx++}`);
      params.push(startDate);
    }
    if (endDate) {
      filters.push(`DATE(dar.punch_time) <= $${idx++}`);
      params.push(endDate);
    }

    if (userType === 'teacher') {
      typeFilter = `AND t.id IS NOT NULL`;
    } else if (userType === 'employee') {
      typeFilter = `AND emp.id IS NOT NULL`;
    }

    if (userId) {
      filters.push(`(e.user_id = $${idx} OR t.id = $${idx} OR emp.id = $${idx})`);
      params.push(userId);
      idx++;
    }

    const sql = `
      SELECT
        dar.*, e.user_id as enrolled_user_id,
        t.id as teacher_id, t.full_name as teacher_name, t.designation as teacher_designation, d_t.name as teacher_department,
        emp.id as employee_id, emp.full_name as employee_name, emp.designation as employee_designation, d_e.name as employee_department
      FROM device_attendance_records dar
      LEFT JOIN device_teacher_enrollments e ON e.device_user_id = dar.device_user_id AND e.tenant_id = dar.tenant_id
      LEFT JOIN teachers t ON e.user_id = t.id
      LEFT JOIN departments d_t ON t.department_id = d_t.id
      LEFT JOIN employees emp ON e.user_id = emp.id
      LEFT JOIN departments d_e ON emp.department_id = d_e.id
      WHERE ${filters.join(' AND ')} ${typeFilter}
      ORDER BY dar.punch_time ASC
    `;

    const res = await pool.query(sql, params);
    return res.rows.map((row) => ({
      ...row,
      user_type: row.teacher_id ? 'teacher' : row.employee_id ? 'employee' : 'unknown',
      name: row.teacher_name || row.employee_name || null,
      designation: row.teacher_designation || row.employee_designation || null,
      department: row.teacher_department || row.employee_department || null,
    }));
  }

  async getSummary(pool, tenantId, { date = null, userType = null } = {}) {
    const targetDate = date || new Date().toISOString().slice(0, 10);
    const params = [tenantId, targetDate];
    let baseQuery = '';

    if (userType === 'teacher') {
      baseQuery = `
        SELECT
          COALESCE(MAX(dar.attendance_status), 'absent') AS status
        FROM teachers t
        LEFT JOIN device_teacher_enrollments e ON e.user_id = t.id AND e.tenant_id = $1
        LEFT JOIN device_attendance_records dar ON dar.tenant_id = $1 AND dar.device_user_id = e.device_user_id AND DATE(dar.punch_time) = $2
        WHERE t.is_active = TRUE
        GROUP BY t.id
      `;
    } else if (userType === 'employee') {
      baseQuery = `
        SELECT
          COALESCE(MAX(dar.attendance_status), 'absent') AS status
        FROM employees emp
        LEFT JOIN device_teacher_enrollments e ON e.user_id = emp.id AND e.tenant_id = $1
        LEFT JOIN device_attendance_records dar ON dar.tenant_id = $1 AND dar.device_user_id = e.device_user_id AND DATE(dar.punch_time) = $2
        WHERE emp.is_active = TRUE
        GROUP BY emp.id
      `;
    } else {
      baseQuery = `
        SELECT status FROM (
          SELECT COALESCE(MAX(dar.attendance_status), 'absent') AS status
          FROM teachers t
          LEFT JOIN device_teacher_enrollments e ON e.user_id = t.id AND e.tenant_id = $1
          LEFT JOIN device_attendance_records dar ON dar.tenant_id = $1 AND dar.device_user_id = e.device_user_id AND DATE(dar.punch_time) = $2
          WHERE t.is_active = TRUE
          GROUP BY t.id
          UNION ALL
          SELECT COALESCE(MAX(dar.attendance_status), 'absent') AS status
          FROM employees emp
          LEFT JOIN device_teacher_enrollments e ON e.user_id = emp.id AND e.tenant_id = $1
          LEFT JOIN device_attendance_records dar ON dar.tenant_id = $1 AND dar.device_user_id = e.device_user_id AND DATE(dar.punch_time) = $2
          WHERE emp.is_active = TRUE
          GROUP BY emp.id
        ) attendance_statuses
      `;
    }

    const res = await pool.query(`SELECT status, COUNT(*) as count FROM (${baseQuery}) statuses GROUP BY status`, params);

    const summary = { present: 0, absent: 0, late: 0, total: 0 };
    res.rows.forEach((r) => {
      const count = parseInt(r.count, 10);
      summary.total += count;
      if (r.status === 'present') summary.present += count;
      if (r.status === 'absent') summary.absent += count;
      if (r.status === 'late') summary.late += count;
    });

    return summary;
  }
}

module.exports = new AttendanceService();
