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
    CREATE TABLE IF NOT EXISTS "calendar_days" (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      month_id UUID NOT NULL REFERENCES "month_class_data"(id) ON DELETE CASCADE,
      day_type_id UUID NOT NULL REFERENCES "day_classification"(id) ON DELETE SET NULL,
      day_number INT NOT NULL,
      day_of_week VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
};


exports.down = function (db) {
  return db.runSql('DROP TABLE IF EXISTS "calendar_days";');
};

exports._meta = {
  version: 1,
};
