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
  // Drop old tables that don't match the expected schema
  // This is only needed if they were created with the wrong schema
  return db.runSql(`
    DROP TABLE IF EXISTS "calendar_days" CASCADE;
    DROP TABLE IF EXISTS "month_class_data" CASCADE;
    DROP TABLE IF EXISTS "day_classification" CASCADE;
    DROP TABLE IF EXISTS "day_category" CASCADE;
    DROP TABLE IF EXISTS "year" CASCADE;
    DROP FUNCTION IF EXISTS set_current_year(UUID);
  `).then(() => {
    // Recreate tables with correct schema
    return db.runSql('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";').then(() => {
      return db.runSql(`
        CREATE TABLE "year" (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          year_label VARCHAR(255) NOT NULL UNIQUE,
          year_label_AD VARCHAR(255),
          year_label_BS VARCHAR(255),
          start_date_AD DATE,
          end_date_AD DATE,
          start_date_BS VARCHAR(255),
          end_date_BS VARCHAR(255),
          start_date DATE NOT NULL,
          end_date DATE NOT NULL,
          is_current BOOLEAN DEFAULT false,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE "month_class_data" (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          year_id UUID NOT NULL REFERENCES "year"(id) ON DELETE CASCADE,
          month_name VARCHAR(255) NOT NULL,
          bs_month_index INTEGER,
          month_start_date_BS VARCHAR(255) NOT NULL,
          month_end_date_BS VARCHAR(255) NOT NULL,
          month_start_date_AD VARCHAR(255) NOT NULL,
          month_end_date_AD VARCHAR(255) NOT NULL,
          month_start_day_BS VARCHAR(255) NOT NULL,
          month_end_day_BS VARCHAR(255) NOT NULL,
          month_start_day_AD VARCHAR(255) NOT NULL,
          month_end_day_AD VARCHAR(255) NOT NULL,
          date_format VARCHAR(10) DEFAULT 'BS',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE "day_category" (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          category_name VARCHAR(255) NOT NULL UNIQUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE "day_classification" (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          category_id UUID REFERENCES "day_category"(id) ON DELETE SET NULL,
          day_type VARCHAR(255) NOT NULL UNIQUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE "calendar_days" (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          year_id UUID NOT NULL REFERENCES "year"(id) ON DELETE CASCADE,
          month_id UUID NOT NULL REFERENCES "month_class_data"(id) ON DELETE CASCADE,
          day_type_id UUID REFERENCES "day_classification"(id) ON DELETE SET NULL,
          day_number INT NOT NULL,
          day_of_week VARCHAR(255) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Seed default day categories
        INSERT INTO "day_category" (category_name) VALUES 
          ('Holiday'),
          ('Exam'),
          ('Annual Day'),
          ('Working Day')
        ON CONFLICT DO NOTHING;

        -- Seed default day types
        INSERT INTO "day_classification" (day_type) VALUES 
          ('School Day'),
          ('Public Holiday'),
          ('Term Exam'),
          ('Half Day')
        ON CONFLICT DO NOTHING;

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
    });
  });
};

exports.down = function (db) {
  return db.runSql(`
    DROP TABLE IF EXISTS "calendar_days" CASCADE;
    DROP TABLE IF EXISTS "month_class_data" CASCADE;
    DROP TABLE IF EXISTS "day_classification" CASCADE;
    DROP TABLE IF EXISTS "day_category" CASCADE;
    DROP TABLE IF EXISTS "year" CASCADE;
  `);
};

exports._meta = {
  version: 1,
};
