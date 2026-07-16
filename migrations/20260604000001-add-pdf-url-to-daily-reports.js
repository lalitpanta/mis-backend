exports.up = function (db, callback) {
  db.runSql(
    `ALTER TABLE daily_reports ADD COLUMN IF NOT EXISTS pdf_url VARCHAR(500)`,
    callback
  );
};

exports.down = function (db, callback) {
  db.runSql(
    `ALTER TABLE daily_reports DROP COLUMN IF EXISTS pdf_url`,
    callback
  );
};
