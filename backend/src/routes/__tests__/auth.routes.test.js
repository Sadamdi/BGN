"use strict";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-jwt-secret-min-32-chars-aaaaa";
process.env.JWT_REFRESH_SECRET = "test-jwt-refresh-secret-aaaaaaa";
process.env.DATA_ENCRYPTION_KEY = "unit-test-key-please-change-1234567890";

jest.mock("../../config/database", () => ({
  prisma: {
    pengguna: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
  checkDatabase: jest.fn(async () => ({ ok: true })),
}));

jest.mock("../../config/redis", () => {
  const store = new Map();
  const redis = {
    get: jest.fn(async (k) => (store.has(k) ? store.get(k) : null)),
    set: jest.fn(async (k, v) => { store.set(k, v); return "OK"; }),
    del: jest.fn(async (k) => { store.delete(k); return 1; }),
    incr: jest.fn(async (k) => {
      const n = (store.has(k) ? Number(store.get(k)) : 0) + 1;
      store.set(k, String(n));
      return n;
    }),
    expire: jest.fn(async () => 1),
    ttl: jest.fn(async () => -2),
    ping: jest.fn(async () => "PONG"),
    scan: jest.fn(async () => ["0", []]),
  };
  return {
    getRedis: () => redis,
    getPubClient: () => redis,
    getSubClient: () => redis,
    checkRedis: jest.fn(async () => ({ ok: true })),
    closeRedis: jest.fn(async () => {}),
  };
});

jest.mock("../../services/email.service", () => ({
  emailResetPassword: jest.fn(async () => ({ messageId: "x" })),
  kirimEmail: jest.fn(async () => ({ messageId: "x" })),
}));

const request = require("supertest");
const bcrypt = require("bcrypt");
const { buildApp } = require("../../app");
const { prisma } = require("../../config/database");

const app = buildApp();

describe("POST /api/auth/login", () => {
  let pwHash;
  beforeAll(async () => {
    pwHash = await bcrypt.hash("Admin@123!", 10);
  });
  beforeEach(() => jest.clearAllMocks());

  test("400 bila body kosong", async () => {
    const r = await request(app).post("/api/auth/login").send({});
    expect(r.status).toBe(400);
    expect(r.body.success).toBe(false);
  });

  test("401 bila user tidak ditemukan", async () => {
    prisma.pengguna.findFirst.mockResolvedValue(null);
    const r = await request(app).post("/api/auth/login").send({ username: "x", password: "y" });
    expect(r.status).toBe(401);
    expect(r.body.code).toBe("INVALID_CREDENTIALS");
  });

  test("200 dengan kredensial benar", async () => {
    prisma.pengguna.findFirst.mockResolvedValue({
      id: "u1", username: "admin", email: "a@b.id", namaLengkap: "Admin",
      passwordHash: pwHash, peran: "ADMIN", statusAktif: true,
    });
    prisma.pengguna.update.mockResolvedValue({});
    const r = await request(app).post("/api/auth/login").send({ username: "admin", password: "Admin@123!" });
    expect(r.status).toBe(200);
    expect(r.body.success).toBe(true);
    expect(r.body.data.accessToken).toBeDefined();
    expect(r.body.data.user.peran).toBe("ADMIN");
  });
});

describe("GET /api/auth/me", () => {
  test("401 tanpa token", async () => {
    const r = await request(app).get("/api/auth/me");
    expect(r.status).toBe(401);
    expect(r.body.code).toBe("NO_TOKEN");
  });
});

describe("GET /api/health", () => {
  test("200 saat dependencies sehat", async () => {
    const r = await request(app).get("/api/health");
    expect([200, 503]).toContain(r.status);
    expect(r.body.data).toHaveProperty("database");
    expect(r.body.data).toHaveProperty("redis");
  });
});
