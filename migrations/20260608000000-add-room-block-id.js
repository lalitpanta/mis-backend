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
    ALTER TABLE rooms
    ADD COLUMN IF NOT EXISTS block_id INTEGER;

    CREATE INDEX IF NOT EXISTS idx_rooms_block_id ON rooms(block_id);
  `);
};

exports.down = function (db) {
  return db.runSql(`
    DROP INDEX IF EXISTS idx_rooms_block_id;
    ALTER TABLE rooms DROP COLUMN IF EXISTS block_id;
  `);
};

exports._meta = {
  version: 1,
};
