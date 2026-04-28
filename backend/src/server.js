"use strict";

require("dotenv").config();

const http = require("http");
const { buildApp } = require("./app");
const { initSocket } = require("./services/socket.service");
const { startSchedulers } = require("./services/scheduler.service");

const PORT = parseInt(process.env.PORT, 10) || 3000;

const app = buildApp();
const server = http.createServer(app);

initSocket(server);

if (process.env.NODE_ENV !== "test") {
  startSchedulers();
  server.listen(PORT, () => {
    console.log("[sipgn-bgn] backend listening on port " + PORT);
    console.log("[sipgn-bgn] frontend allowed: " + (process.env.FRONTEND_URL || "http://localhost:5173"));
  });
}

function shutdown() {
  console.log("[sipgn-bgn] shutting down...");
  server.close(() => process.exit(0));
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

module.exports = { app, server };
