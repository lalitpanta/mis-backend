const { centralPool } = require("../config/tenantDb");
const { patchAllTenantSchemas } = require("../services/tenantSchemaPatcher");

const StartServer = async (app) => {
  const PORT = Number(process.env.PORT || 5000);
  const resolveListenHost = () => {
    if (process.env.NODE_ENV === "production" || !process.env.HOST) {
      return "0.0.0.0";
    }

    return process.env.HOST;
  };
  const host = resolveListenHost();

  const server = app.listen(PORT, host, () => {
    console.log(`
╔════════════════════════════════════════════╗
║  🚀 Multi-Tenant School Management System  ║
║     Server running on port ${PORT}       ║
║     Environment: ${(process.env.NODE_ENV || "development").padEnd(18)}║
╚════════════════════════════════════════════╝
    `);

    // Run tenant schema patching in the background (non-blocking)
    patchAllTenantSchemas().catch((err) => {
      console.error("❌ Error in tenant schema patcher:", err);
    });
  });

  // ─── Graceful Shutdown Handler ───────────────────────────────────────────────
  const gracefulShutdown = (signal) => {
    console.log(`\n  ${signal} received. Shutting down gracefully...`);

    // 1. Stop accepting new connections
    server.close(async () => {
      console.log("🔌 HTTP server closed");

      try {
        // 2. Close central DB pool — wait for active queries to finish
        await centralPool.end();
        console.log("🗄️  Database pool closed");
        console.log("👋 Process exiting cleanly");
        process.exit(0);
      } catch (err) {
        console.error("❌ Error during DB pool shutdown:", err);
        process.exit(1);
      }
    });

    // 3. Force kill if graceful shutdown takes too long (10s)
    setTimeout(() => {
      console.error("❌ Graceful shutdown timed out. Forcing exit.");
      process.exit(1);
    }, 10_000).unref(); // .unref() so this timer doesn't keep the process alive on its own
  };

  // ─── Process Signal Handlers ─────────────────────────────────────────────────

  // Ctrl+C in terminal (dev) or Docker stop
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));

  // Kubernetes / systemd / Heroku shutdown signal
  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

  // ─── Error Handlers ───────────────────────────────────────────────────────────

  // Unhandled promise rejections — e.g. await someQuery() with no try/catch
  process.on("unhandledRejection", (reason, promise) => {
    console.error("🔥 Unhandled Promise Rejection:");
    console.error("   Reason:", reason);
    // Don't exit immediately — log it and let the request fail naturally
    // If you want strict mode, uncomment below:
    // gracefulShutdown("unhandledRejection");
  });

  // Synchronous throws that were never caught — always fatal
  process.on("uncaughtException", (err) => {
    console.error("💥 Uncaught Exception — this is always fatal:");
    console.error(err);
    gracefulShutdown("uncaughtException");
  });

  return server;
};

module.exports = StartServer;
