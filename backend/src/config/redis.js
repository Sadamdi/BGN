"use strict";

const Redis = require("ioredis");

let client = null;
let pubClient = null;
let subClient = null;

function createClient(name) {
  const url = process.env.REDIS_URL || "redis://localhost:6379";
  const c = new Redis(url, {
    lazyConnect: false,
    maxRetriesPerRequest: 2,
    enableOfflineQueue: true,
  });
  c.on("error", (err) => {
    console.error("[redis:" + name + "] error:", err.message);
  });
  return c;
}

function getRedis() {
  if (!client) client = createClient("main");
  return client;
}

function getPubClient() {
  if (!pubClient) pubClient = createClient("pub");
  return pubClient;
}

function getSubClient() {
  if (!subClient) subClient = createClient("sub");
  return subClient;
}

async function checkRedis() {
  try {
    const pong = await getRedis().ping();
    return { ok: pong === "PONG" };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function closeRedis() {
  await Promise.all([client, pubClient, subClient].filter(Boolean).map((c) => c.quit().catch(() => {})));
}

module.exports = {
  getRedis,
  getPubClient,
  getSubClient,
  checkRedis,
  closeRedis,
};
