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
    CREATE TABLE IF NOT EXISTS results (
      id SERIAL PRIMARY KEY,
      classroom_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      subject VARCHAR(100) NOT NULL,
      first_term_marks NUMERIC(5, 2) DEFAULT 0,
      second_term_marks NUMERIC(5, 2) DEFAULT 0,
      final_marks NUMERIC(5, 2) DEFAULT 0,
      grade VARCHAR(5),
      comments TEXT,
      is_published BOOLEAN DEFAULT false,
      created_by UUID NOT NULL,
      updated_by UUID,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `).then(() => {
    return db.runSql(`
      CREATE INDEX IF NOT EXISTS idx_results_classroom_id ON results(classroom_id);
      CREATE INDEX IF NOT EXISTS idx_results_student_id ON results(student_id);
      CREATE INDEX IF NOT EXISTS idx_results_created_by ON results(created_by);
      CREATE INDEX IF NOT EXISTS idx_results_classroom_student ON results(classroom_id, student_id);
    `);
  });
};

exports.down = function (db) {
  return db.runSql('DROP TABLE IF EXISTS results;');
};

exports._meta = {
  version: 1,
};
