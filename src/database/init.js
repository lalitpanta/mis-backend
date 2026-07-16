const pool = require("../config/db");

const initDB = async () => {
  try {
    console.log("🚀 Initializing Database...");

    // 1. Create UUID extension
    await pool.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');

    // 2. Create "year" table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "year" (
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
        is_current BOOLEAN DEFAULT false
      );
    `);

    // 3. Create "month_class_data" table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "month_class_data" (
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
    `);

    // 4. Create "day_category" table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "day_category" (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        category_name VARCHAR(255) NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 5. Create "day_classification" table (updated with category link)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "day_classification" (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        category_id UUID REFERENCES "day_category"(id) ON DELETE SET NULL,
        day_type VARCHAR(255) NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 6. Create "calendar_days" table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "calendar_days" (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        year_id UUID NOT NULL REFERENCES "year"(id) ON DELETE CASCADE,
        month_id UUID NOT NULL REFERENCES "month_class_data"(id) ON DELETE CASCADE,
        day_type_id UUID REFERENCES "day_classification"(id) ON DELETE SET NULL,
        day_number INT NOT NULL,
        day_of_week VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 7. Create "settings" table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS settings (
        id SERIAL PRIMARY KEY,
        key VARCHAR(100) NOT NULL UNIQUE,
        value TEXT,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 8. Create school profile tables
    await pool.query(`
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

    // 9. Create stored procedure to set current year
    await pool.query(`
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

    // 9. Create stored procedure to refresh year category stats
    await pool.query(`
      CREATE OR REPLACE FUNCTION refresh_year_category_stats(year_id UUID)
      RETURNS void AS $$
      BEGIN
        -- This function recalculates statistics for day categories in a year
        -- For now, it's a placeholder - can be extended to compute actual stats
        -- This prevents errors when called from calendar_days service
      END;
      $$ LANGUAGE plpgsql;
    `);

    // 10. Seed default categories if empty
    const catCountRes = await pool.query('SELECT count(*) FROM "day_category"');
    if (parseInt(catCountRes.rows[0].count) === 0) {
      console.log("🌱 Seeding default day categories...");
      const defaultCats = ["Holiday", "Exam", "Annual Day", "Working Day"];
      for (const cat of defaultCats) {
        await pool.query(
          'INSERT INTO "day_category" (category_name) VALUES ($1) ON CONFLICT DO NOTHING',
          [cat],
        );
      }
    }

    // 11. Optional: Seed default day types if table is empty
    const countResult = await pool.query(
      'SELECT count(*) FROM "day_classification"',
    );
    const actualCount = parseInt(countResult.rows[0].count);
    if (actualCount === 0) {
      console.log("🌱 Seeding default day types...");
      const defaultTypes = [
        "School Day",
        "Public Holiday",
        "Term Exam",
        "Half Day",
      ];
      for (const type of defaultTypes) {
        await pool.query(
          'INSERT INTO "day_classification" (day_type) VALUES ($1) ON CONFLICT DO NOTHING',
          [type],
        );
      }
    }

    console.log("✅ Database initialized successfully");
  } catch (err) {
    console.error("❌ Database initialization failed:", err.message);
    // Don't exit process here, let the main server handle it if needed
    // or you can throw it to be caught in db.js
    throw err;
  }
};

module.exports = initDB;
