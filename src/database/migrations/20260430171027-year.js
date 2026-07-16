"use strict";

var dbm;
var type;
var seed;

/**
 * We receive the dbmigrate dependency from dbmigrate initially.
 * This enables us to not have to rely on NODE_PATH.
 */
exports.setup = function (options, seedLink) {
  dbm = options.dbmigrate;
  type = dbm.dataType;
  seed = seedLink;
};

exports.up = function (db) {
  return db.runSql('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";').then(() => {
    return db.runSql(`
      CREATE TABLE IF NOT EXISTS "year" (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        year_label VARCHAR(255) NOT NULL UNIQUE,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL
      );
    `);
  });
};

exports.down = function (db) {
  return db.runSql('DROP TABLE IF EXISTS "year";');
};

exports._meta = {
  version: 1,
};
