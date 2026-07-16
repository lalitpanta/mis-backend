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
    -- Create stored procedure to set current year
    CREATE OR REPLACE FUNCTION set_current_year(year_id UUID)
    RETURNS void AS $$
    BEGIN
      -- Set all years to not current
      UPDATE "year" SET is_current = false;
      
      -- Set the specified year as current
      UPDATE "year" SET is_current = true WHERE id = year_id;
    END;
    $$ LANGUAGE plpgsql;
  `);
};

exports.down = function (db) {
  return db.runSql('DROP FUNCTION IF EXISTS set_current_year(UUID);');
};

exports._meta = {
  version: 1,
};
