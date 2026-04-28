"use strict";

require("dotenv").config();

const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const path = require("path");

const { globalLimiter } = require("./middleware/rateLimiter");
const { requestLogger } = require("./middleware/requestLogger");
const { errorHandler, notFoundHandler } = require("./middleware/errorHandler");
const { checkDatabase } = require("./config/database");
const { checkRedis } = require("./config/redis");
const apiRouter = require("./routes");

function buildApp() {
  const app = express();

  app.set("trust proxy", 1);

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "blob:"],
          connectSrc: ["'self'"],
        },
      },
      hsts: { maxAge: 31536000, includeSubDomains: true },
      crossOriginResourcePolicy: { policy: "cross-origin" },
    })
  );

  const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
  app.use(
    cors({
      origin: FRONTEND_URL.split(",").map((s) => s.trim()),
      credentials: true,
    })
  );

  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));

  app.use(requestLogger);
  app.use(globalLimiter);

  const UPLOAD_DIR = process.env.UPLOAD_DIR || "./uploads";
  app.use("/uploads", express.static(path.resolve(UPLOAD_DIR)));

  app.get("/api/health", async (_req, res) => {
    const db = await checkDatabase();
    const redis = await checkRedis();
    const ok = db.ok && redis.ok;
    res.status(ok ? 200 : 503).json({
      success: ok,
      message: ok ? "OK" : "Beberapa layanan tidak tersedia",
      data: {
        status: ok ? "healthy" : "degraded",
        database: db,
        redis: redis,
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      },
    });
  });

  app.use("/api", apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = { buildApp };
