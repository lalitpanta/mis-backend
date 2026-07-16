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
    ALTER TABLE students ADD COLUMN IF NOT EXISTS guardian_email VARCHAR(100);
    ALTER TABLE students ADD COLUMN IF NOT EXISTS documents JSONB DEFAULT '[]'::jsonb;
  `);
};

exports.down = function (db) {
  return db.runSql(`
    ALTER TABLE students DROP COLUMN IF EXISTS documents;
    ALTER TABLE students DROP COLUMN IF EXISTS guardian_email;
  `);
};

exports._meta = {
  version: 1,
};
