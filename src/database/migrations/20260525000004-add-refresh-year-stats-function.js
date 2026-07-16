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
    CREATE OR REPLACE FUNCTION refresh_year_category_stats(year_id UUID)
    RETURNS void AS $$
    BEGIN
      -- This function recalculates statistics for day categories in a year
      -- For now, it's a placeholder - can be extended to compute actual stats
      -- This prevents errors when called from calendar_days service
    END;
    $$ LANGUAGE plpgsql;
  `);
};

exports.down = function (db) {
  return db.runSql('DROP FUNCTION IF EXISTS refresh_year_category_stats(UUID);');
};

exports._meta = {
  version: 1,
};
