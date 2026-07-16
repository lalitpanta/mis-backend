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
    CREATE TABLE IF NOT EXISTS school_profile (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255),
      email VARCHAR(255),
      phone VARCHAR(100),
      address TEXT,
      website VARCHAR(255),
      motto TEXT,
      logo TEXT,
      established DATE,
      country VARCHAR(100),
      total_floors INTEGER,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS school_blocks (
      id SERIAL PRIMARY KEY,
      profile_id INTEGER NOT NULL REFERENCES school_profile(id) ON DELETE CASCADE,
      block_name VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS school_floors (
      id SERIAL PRIMARY KEY,
      block_id INTEGER NOT NULL REFERENCES school_blocks(id) ON DELETE CASCADE,
      floor_number INTEGER NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(block_id, floor_number)
    );
  `);
};

exports.down = function (db) {
  return db.runSql(`
    DROP TABLE IF EXISTS school_floors;
    DROP TABLE IF EXISTS school_blocks;
    DROP TABLE IF EXISTS school_profile;
  `);
};

exports._meta = {
  version: 1,
};
