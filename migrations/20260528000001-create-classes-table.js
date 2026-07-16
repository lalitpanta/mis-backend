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
    CREATE TABLE IF NOT EXISTS classes (
      id SERIAL PRIMARY KEY,
      class_name VARCHAR(100) NOT NULL,
      total_students INTEGER NOT NULL DEFAULT 0,
      faculty VARCHAR(255),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);
};

exports.down = function (db) {
  return db.runSql('DROP TABLE IF EXISTS classes;');
};

exports._meta = {
  version: 1,
};
