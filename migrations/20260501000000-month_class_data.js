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
    CREATE TABLE IF NOT EXISTS "month_class_data" (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      year_id UUID NOT NULL REFERENCES "year"(id) ON DELETE CASCADE,
      month_name VARCHAR(255) NOT NULL,
      month_start_date_BS VARCHAR(255) NOT NULL,
      month_end_date_BS VARCHAR(255) NOT NULL,
      month_start_date_AD VARCHAR(255) NOT NULL,
      month_end_date_AD VARCHAR(255) NOT NULL,
      month_start_day_BS VARCHAR(255) NOT NULL,
      month_end_day_BS VARCHAR(255) NOT NULL,
      month_start_day_AD VARCHAR(255) NOT NULL,
      month_end_day_AD VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
};

exports.down = function (db) {
  return db.runSql('DROP TABLE IF EXISTS "month_class_data";');
};

exports._meta = {
  version: 1,
};
