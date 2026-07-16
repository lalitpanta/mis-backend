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
    CREATE TABLE IF NOT EXISTS sections (
      id SERIAL PRIMARY KEY,
      section_name VARCHAR(100) NOT NULL,
      room_id INTEGER REFERENCES rooms(id) ON DELETE SET NULL,
      total_students INTEGER NOT NULL DEFAULT 0,
      monitor_name VARCHAR(255),
      class_teacher_id UUID,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);
};

exports.down = function (db) {
  return db.runSql('DROP TABLE IF EXISTS sections;');
};

exports._meta = {
  version: 1,
};
