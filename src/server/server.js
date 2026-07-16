require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const { initializeCentralDatabase } = require("../config/initCentralDb");
const { getDatabaseConfig } = require("../config/databaseConfig");
const app = express();
const StartServer = require("./startServer");
const routes = require("../routing/index");

// ── CORS Middleware ────────────────────────────────────────────────
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:5174",
      "http://localhost:5175",
      "http://localhost:3000",
      "http://localhost:5000",
      "http://localhost:5001",
    ],
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Tenant-ID"],
    credentials: true,
    optionsSuccessStatus: 200,
  }),
);

// ── Other Middleware ────────────────────────────────────────────────
// Increase request body size limits to accomodate larger payloads
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(
  "/uploads",
  express.static(path.join(__dirname, "..", "..", "uploads")),
);

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

// ── Routes ────────────────────────────────────────────────
app.use("/v1", routes); // Registering v1 routes under /v1 path

// ── Error Handling ────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error("Error:", err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
});

// ── 404 Handler ────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

// Run DB migrations automatically on startup unless disabled
const { exec } = require("child_process");
const PORT = Number(process.env.PORT || 5000);
const host = process.env.HOST || "0.0.0.0";
const migrationsCwd = path.resolve(__dirname, "..", "..");

if (PORT === 5432) {
  console.warn(
    "⚠️ Render service is configured to use port 5432. This is the PostgreSQL default port. Remove PORT=5432 from Render env vars and let Render assign the service port automatically.",
  );
}

const startApp = () => {
  app.listen(PORT, host, () => {
    console.log(`
╔════════════════════════════════════════════╗
║  🚀 Multi-Tenant School Management System  ║
║     Server running on port ${PORT}       ║
║     Environment: ${(process.env.NODE_ENV || "development").padEnd(18)}║
╚════════════════════════════════════════════╝
  `);
  });
};

const enableAutoMigrate =
  process.env.ENABLE_AUTO_MIGRATE &&
  process.env.ENABLE_AUTO_MIGRATE.toLowerCase() === "true";

if (enableAutoMigrate) {
  const dbConfig = getDatabaseConfig();
  process.env.DB_HOST = dbConfig.host;
  process.env.DB_PORT = String(dbConfig.port);
  process.env.DB_NAME = dbConfig.database;
  process.env.DB_USER = dbConfig.user;
  process.env.DB_PASSWORD = dbConfig.password;
  process.env.DB_SSL = process.env.DB_SSL || "true";
}

const startAppWithCentralInit = async () => {
  try {
    await initializeCentralDatabase();
  } catch (err) {
    console.warn(
      "⚠️ Central database initialization failed, continuing startup:",
      err.message || err,
    );
  }
  startApp();
};

if (!enableAutoMigrate) {
  console.log(
    "Auto-migration is disabled by default. Set ENABLE_AUTO_MIGRATE=true to enable it.",
  );
  startAppWithCentralInit();
} else {
  console.log("Running DB migrations before starting server...");
  exec("npx db-migrate up", { cwd: migrationsCwd }, (err, stdout, stderr) => {
    if (err) {
      console.error("Migration error:", err);
      console.error(stderr);
      // still start the app even if migrations fail, to allow manual intervention
      startAppWithCentralInit();
      return;
    }
    console.log(stdout);
    console.log("Migrations completed. Starting server.");
    startAppWithCentralInit();
  });
}
