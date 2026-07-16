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
    -- Add new columns to tenant_users if they don't exist
    ALTER TABLE tenant_users
    ADD COLUMN IF NOT EXISTS name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS phone VARCHAR(20),
    ADD COLUMN IF NOT EXISTS department_store UUID,
    ADD COLUMN IF NOT EXISTS authority_mode VARCHAR(50) DEFAULT 'role_access',
    ADD COLUMN IF NOT EXISTS module_access JSON DEFAULT '[]'::json;

    -- Create departments/stores table if it doesn't exist
    CREATE TABLE IF NOT EXISTS departments (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      name VARCHAR(255) NOT NULL,
      code VARCHAR(100),
      description TEXT,
      type VARCHAR(50) DEFAULT 'department',
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Add foreign key constraint
    ALTER TABLE tenant_users
    ADD CONSTRAINT fk_tenant_users_department
    FOREIGN KEY (department_store) 
    REFERENCES departments(id) 
    ON DELETE SET NULL;

    -- Create indexes
    CREATE INDEX IF NOT EXISTS idx_tenant_users_name ON tenant_users(name);
    CREATE INDEX IF NOT EXISTS idx_tenant_users_phone ON tenant_users(phone);
    CREATE INDEX IF NOT EXISTS idx_departments_code ON departments(code);
  `);
};

exports.down = function (db) {
  return db.runSql(`
    ALTER TABLE tenant_users
    DROP CONSTRAINT IF EXISTS fk_tenant_users_department;

    ALTER TABLE tenant_users
    DROP COLUMN IF EXISTS module_access,
    DROP COLUMN IF EXISTS authority_mode,
    DROP COLUMN IF EXISTS department_store,
    DROP COLUMN IF EXISTS phone,
    DROP COLUMN IF EXISTS name;

    DROP TABLE IF EXISTS departments;
  `);
};

exports._meta = {
  version: 1,
};
