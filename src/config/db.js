const { Pool } = require("pg");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });
const { getDatabaseConfig } = require("./databaseConfig");

const pool = new Pool({
  ...getDatabaseConfig(),
  min: parseInt(process.env.DB_POOL_MIN, 10),
  max: parseInt(process.env.DB_POOL_MAX, 10),
  idleTimeoutMillis: 30000, // close idle clients after 30s
  connectionTimeoutMillis: 2000, // fail fast if DB unreachable
});

// Test connection on startup
pool.connect((err, client, release) => {
  if (err) {
    console.error(" Database connection failed:", err.message);
    process.exit(1);
  }
  release();
  console.log("PostgreSQL connected successfully");
});

module.exports = pool;
