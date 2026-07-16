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
    CREATE TABLE IF NOT EXISTS rooms (
      id SERIAL PRIMARY KEY,
      room_number VARCHAR(50) NOT NULL,
      floor_number INTEGER,
      room_type VARCHAR(100) NOT NULL DEFAULT 'Classroom',
      total_capacity INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);
};

exports.down = function (db) {
  return db.runSql("DROP TABLE IF EXISTS rooms;");
};

exports._meta = {
  version: 1,
};
