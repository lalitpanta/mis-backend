"use strict";

var dbm;
var type;
var seed;

/**
 * We receive the dbmigrate dependency from dbmigrate initially.
 * This enables us to not have to rely on NODE_PATH.
 */
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
      CREATE TABLE IF NOT EXISTS "devices" (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL,
        device_name VARCHAR(255) NOT NULL,
        device_type VARCHAR(50) NOT NULL DEFAULT 'ZKTeco' CHECK (device_type IN ('ZKTeco', 'eSSL', 'Suprema')),
        ip_address VARCHAR(50) NOT NULL,
        port INTEGER DEFAULT 5000,
        location VARCHAR(255),
        connection_method VARCHAR(20) DEFAULT 'pull' CHECK (connection_method IN ('pull', 'push', 'ADMS')),
        pull_interval_minutes INTEGER DEFAULT 5,
        enabled BOOLEAN DEFAULT true,
        last_synced_at TIMESTAMP,
        connection_status VARCHAR(20) DEFAULT 'unreachable' CHECK (connection_status IN ('online', 'offline', 'unreachable')),
        last_status_check_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }).then(() => {
    return db.runSql(`
      CREATE TABLE IF NOT EXISTS "device_sync_logs" (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL,
        device_id INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
        sync_type VARCHAR(20) DEFAULT 'auto' CHECK (sync_type IN ('manual', 'auto')),
        status VARCHAR(20) NOT NULL CHECK (status IN ('success', 'partial', 'failed')),
        records_pulled INTEGER DEFAULT 0,
        records_saved INTEGER DEFAULT 0,
        records_skipped INTEGER DEFAULT 0,
        error_message TEXT,
        started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }).then(() => {
    return db.runSql(`
      CREATE TABLE IF NOT EXISTS "device_teacher_enrollments" (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL,
        device_id INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
        user_id UUID NOT NULL,
        device_user_id VARCHAR(50) NOT NULL,
        enrollment_status VARCHAR(20) DEFAULT 'pending' CHECK (enrollment_status IN ('enrolled', 'pending', 'failed')),
        enrolled_at TIMESTAMP,
        last_sync_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(device_id, user_id)
      );
    `);
  }).then(() => {
    return db.runSql(`
      CREATE TABLE IF NOT EXISTS "device_attendance_records" (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL,
        device_id INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
        user_id UUID,
        device_user_id VARCHAR(50) NOT NULL,
        punch_time TIMESTAMP NOT NULL,
        punch_type VARCHAR(10) DEFAULT 'in' CHECK (punch_type IN ('in', 'out')),
        attendance_status VARCHAR(20) DEFAULT 'present' CHECK (attendance_status IN ('present', 'late', 'absent')),
        marked_as VARCHAR(20) DEFAULT 'auto' CHECK (marked_as IN ('auto', 'manual')),
        manual_override_note TEXT,
        is_duplicate BOOLEAN DEFAULT false,
        synced_from_device BOOLEAN DEFAULT false,
        synced_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }).then(() => {
    return db.runSql(`
      CREATE TABLE IF NOT EXISTS "unmatched_device_ids" (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL,
        device_id INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
        device_user_id VARCHAR(50) NOT NULL,
        first_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_seen_at TIMESTAMP,
        punch_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(device_id, device_user_id)
      );
    `);
  }).then(() => {
    return db.runSql(`
      CREATE INDEX idx_devices_tenant ON devices(tenant_id);
      CREATE INDEX idx_device_sync_logs_tenant_device ON device_sync_logs(tenant_id, device_id);
      CREATE INDEX idx_device_enrollments_tenant_device ON device_teacher_enrollments(tenant_id, device_id, user_id);
      CREATE INDEX idx_device_attendance_tenant_device ON device_attendance_records(tenant_id, device_id, punch_time);
      CREATE INDEX idx_unmatched_ids_tenant_device ON unmatched_device_ids(tenant_id, device_id);
    `);
  });
};

exports.down = function (db) {
  return db.runSql('DROP TABLE IF EXISTS "unmatched_device_ids" CASCADE;')
    .then(() => db.runSql('DROP TABLE IF EXISTS "device_attendance_records" CASCADE;'))
    .then(() => db.runSql('DROP TABLE IF EXISTS "device_teacher_enrollments" CASCADE;'))
    .then(() => db.runSql('DROP TABLE IF EXISTS "device_sync_logs" CASCADE;'))
    .then(() => db.runSql('DROP TABLE IF EXISTS "devices" CASCADE;'));
};

exports._meta = {
  version: 1,
};
