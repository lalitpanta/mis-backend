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
    -- Drop existing foreign key constraints if they exist
    ALTER TABLE IF EXISTS results DROP CONSTRAINT IF EXISTS results_classroom_id_fkey;
    
    -- Rename classroom column to section in results table if needed
    ALTER TABLE IF EXISTS results RENAME COLUMN classroom_id TO section_id;
    
    -- Modify classes table to keep only necessary columns
    ALTER TABLE classes DROP COLUMN IF EXISTS faculty;
    ALTER TABLE classes ADD COLUMN IF NOT EXISTS number_of_sections INTEGER DEFAULT 1;
    
    -- Create sections table
    CREATE TABLE IF NOT EXISTS sections (
      id SERIAL PRIMARY KEY,
      class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      section_name VARCHAR(100) NOT NULL,
      total_students INTEGER NOT NULL DEFAULT 0,
      monitor_id UUID REFERENCES tenant_users(id) ON DELETE SET NULL,
      block_id INTEGER REFERENCES school_blocks(id) ON DELETE SET NULL,
      floor_number INTEGER,
      room_id INTEGER REFERENCES rooms(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE INDEX IF NOT EXISTS idx_sections_class_id ON sections(class_id);
    CREATE INDEX IF NOT EXISTS idx_sections_monitor_id ON sections(monitor_id);
    CREATE INDEX IF NOT EXISTS idx_sections_block_id ON sections(block_id);
    CREATE INDEX IF NOT EXISTS idx_sections_room_id ON sections(room_id);
    
    -- Create section_students junction table
    CREATE TABLE IF NOT EXISTS section_students (
      section_id INTEGER NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
      student_id UUID NOT NULL REFERENCES tenant_users(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (section_id, student_id)
    );
    
    CREATE INDEX IF NOT EXISTS idx_section_students_student ON section_students(student_id);
  `);
};

exports.down = function (db) {
  return db.runSql(`
    DROP TABLE IF EXISTS section_students;
    DROP TABLE IF EXISTS sections;
    ALTER TABLE classes DROP COLUMN IF EXISTS number_of_sections;
    ALTER TABLE classes ADD COLUMN faculty VARCHAR(255);
    ALTER TABLE IF EXISTS results RENAME COLUMN section_id TO classroom_id;
  `);
};

exports._meta = {
  version: 1,
};
