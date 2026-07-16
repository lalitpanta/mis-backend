'use strict';

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
    CREATE TABLE IF NOT EXISTS daily_report_templates (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      template JSONB NOT NULL,
      created_by UUID NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS daily_reports (
      id SERIAL PRIMARY KEY,
      student_id INTEGER NOT NULL,
      classroom_id INTEGER,
      template_id INTEGER REFERENCES daily_report_templates(id) ON DELETE SET NULL,
      report JSONB NOT NULL,
      sent BOOLEAN DEFAULT FALSE,
      sent_to VARCHAR(50),
      created_by UUID,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_daily_reports_student ON daily_reports(student_id);
    CREATE INDEX IF NOT EXISTS idx_daily_reports_template ON daily_reports(template_id);
  `);
};

exports.down = function (db) {
  return db.runSql('DROP TABLE IF EXISTS daily_reports; DROP TABLE IF EXISTS daily_report_templates;');
};

exports._meta = {
  version: 1,
};
