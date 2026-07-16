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
    ALTER TABLE rooms DROP COLUMN IF EXISTS monitor_name;
  `);
};

exports.down = function (db) {
  return db.runSql(`
    ALTER TABLE rooms ADD COLUMN IF NOT EXISTS monitor_name VARCHAR(255);
  `);
};

exports._meta = {
  version: 1,
};
