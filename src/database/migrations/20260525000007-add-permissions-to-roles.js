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
    -- Add permissions column to roles table to store module permission keys
    ALTER TABLE roles
    ADD COLUMN IF NOT EXISTS permissions JSON DEFAULT '[]'::json;
  `);
};

exports.down = function (db) {
  return db.runSql(`
    ALTER TABLE roles
    DROP COLUMN IF EXISTS permissions;
  `);
};

exports._meta = {
  version: 1,
};
