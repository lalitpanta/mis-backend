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
      CREATE TABLE IF NOT EXISTS daily_report_templates (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        template JSONB NOT NULL DEFAULT '{"sections":[]}',
        created_by UUID,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }).then(() => {
    return db.runSql(`
      CREATE INDEX idx_daily_templates_tenant ON daily_report_templates(tenant_id);
    `);
  }).then(() => {
    return db.runSql(`
      CREATE TABLE IF NOT EXISTS daily_reports (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL,
        student_id UUID NOT NULL,
        classroom_id UUID,
        template_id INTEGER REFERENCES daily_report_templates(id) ON DELETE SET NULL,
        report JSONB NOT NULL DEFAULT '{}',
        sent BOOLEAN DEFAULT FALSE,
        sent_to VARCHAR(255),
        sent_via VARCHAR(20) CHECK (sent_via IN ('whatsapp', 'email', 'sms')),
        sent_at TIMESTAMP,
        created_by UUID,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }).then(() => {
    return db.runSql(`
      CREATE INDEX idx_daily_reports_tenant_student ON daily_reports(tenant_id, student_id);
      CREATE INDEX idx_daily_reports_template ON daily_reports(template_id);
    `);
  });
};

exports.down = function (db) {
  return db.runSql('DROP TABLE IF EXISTS daily_reports CASCADE;')
    .then(() => {
      return db.runSql('DROP TABLE IF EXISTS daily_report_templates CASCADE;');
    });
};

exports._meta = {
  version: 1,
};
