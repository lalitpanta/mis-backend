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
    ALTER TABLE "year"
    ADD COLUMN IF NOT EXISTS year_label_AD VARCHAR(255),
    ADD COLUMN IF NOT EXISTS year_label_BS VARCHAR(255),
    ADD COLUMN IF NOT EXISTS start_date_AD DATE,
    ADD COLUMN IF NOT EXISTS end_date_AD DATE,
    ADD COLUMN IF NOT EXISTS start_date_BS VARCHAR(255),
    ADD COLUMN IF NOT EXISTS end_date_BS VARCHAR(255),
    ADD COLUMN IF NOT EXISTS is_current BOOLEAN DEFAULT false;
  `);
};

exports.down = function (db) {
  return db.runSql(`
    ALTER TABLE "year"
    DROP COLUMN IF EXISTS year_label_AD,
    DROP COLUMN IF EXISTS year_label_BS,
    DROP COLUMN IF EXISTS start_date_AD,
    DROP COLUMN IF EXISTS end_date_AD,
    DROP COLUMN IF EXISTS start_date_BS,
    DROP COLUMN IF EXISTS end_date_BS,
    DROP COLUMN IF EXISTS is_current;
  `);
};

exports._meta = {
  version: 1,
};
