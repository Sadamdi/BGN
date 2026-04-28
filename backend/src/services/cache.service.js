"use strict";

const { getRedis } = require("../config/redis");

async function getOrSet(key, ttlSeconds, loader) {
  const redis = getRedis();
  try {
    const cached = await redis.get(key);
    if (cached) return JSON.parse(cached);
  } catch (_) {}
  const fresh = await loader();
  try {
    await redis.set(key, JSON.stringify(fresh), "EX", ttlSeconds);
  } catch (_) {}
  return fresh;
}

async function invalidatePrefix(prefix) {
  const redis = getRedis();
  try {
    let cursor = "0";
    do {
      const [next, keys] = await redis.scan(cursor, "MATCH", prefix + "*", "COUNT", 200);
      cursor = next;
      if (keys.length) await redis.del(keys);
    } while (cursor !== "0");
  } catch (_) {}
}

module.exports = { getOrSet, invalidatePrefix };
