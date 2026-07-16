"use strict";

var dbm;
var type;
var seed;

exports.setup = function (options, seedLink) {
  dbm = options.dbmigrate;
  type = dbm.dataType;
  seed = seedLink;
};

exports.up = function (db) {
  return db.runSql(`
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
  `).then(() => {
    return db.runSql(`
      CREATE TABLE IF NOT EXISTS teacher_employee_attendance (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL,
        user_type VARCHAR(20) NOT NULL CHECK (user_type IN ('teacher','employee')),
        user_id UUID NOT NULL,
        attendance_date DATE NOT NULL,
        check_in TIMESTAMP,
        check_out TIMESTAMP,
        device_id INTEGER,
        device_user_id VARCHAR(100),
        attendance_status VARCHAR(20) DEFAULT 'present' CHECK (attendance_status IN ('present','late','absent','on_leave')),
        working_hours NUMERIC,
        remarks TEXT,
        is_holiday BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }).then(() => {
    return db.runSql(`
      CREATE INDEX idx_attendance_tenant_user_date ON teacher_employee_attendance(tenant_id, user_id, attendance_date);
    `);
  });
};

exports.down = function (db) {
  return db.runSql('DROP TABLE IF EXISTS teacher_employee_attendance CASCADE;');
};

exports._meta = {
  version: 1,
};
