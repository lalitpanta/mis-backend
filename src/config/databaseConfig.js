const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

function getDatabaseConfig(overrides = {}) {
  const parsedUrl = process.env.DATABASE_URL
    ? new URL(process.env.DATABASE_URL)
    : null;

  const config = {
    host:
      overrides.host ||
      process.env.DB_HOST ||
      parsedUrl?.hostname ||
      "localhost",
    port: Number(
      overrides.port || process.env.DB_PORT || parsedUrl?.port || 5432,
    ),
    database:
      overrides.database ||
      process.env.DB_NAME ||
      (parsedUrl?.pathname ? parsedUrl.pathname.slice(1) : undefined),
    user:
      overrides.user ||
      process.env.DB_USER ||
      parsedUrl?.username ||
      "postgres",
    password:
      overrides.password ||
      process.env.DB_PASSWORD ||
      parsedUrl?.password ||
      "",
  };

  const sslEnabled =
    process.env.DB_SSL === "true" || process.env.NODE_ENV === "production";

  if (sslEnabled) {
    config.ssl = { rejectUnauthorized: false };
  }

  return config;
}

module.exports = {
  getDatabaseConfig,
};
