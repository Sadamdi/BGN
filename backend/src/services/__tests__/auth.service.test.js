"use strict";

process.env.JWT_SECRET = "test-jwt-secret-min-32-chars-aaaaa";
process.env.JWT_REFRESH_SECRET = "test-jwt-refresh-secret-aaaaaaa";
process.env.DATA_ENCRYPTION_KEY = "unit-test-key-please-change-1234567890";

jest.mock("../../config/database", () => {
  const prisma = {
    pengguna: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };
  return { prisma, checkDatabase: jest.fn() };
});

jest.mock("../../config/redis", () => {
  const store = new Map();
  const ttls = new Map();
  const redis = {
    get: jest.fn(async (k) => (store.has(k) ? store.get(k) : null)),
    set: jest.fn(async (k, v) => { store.set(k, v); return "OK"; }),
    del: jest.fn(async (k) => { store.delete(k); return 1; }),
    incr: jest.fn(async (k) => {
      const n = (store.has(k) ? Number(store.get(k)) : 0) + 1;
      store.set(k, String(n));
      return n;
    }),
    expire: jest.fn(async (k, t) => { ttls.set(k, t); return 1; }),
    ttl: jest.fn(async (k) => (store.has(k) ? (ttls.get(k) || 60) : -2)),
    quit: jest.fn(async () => {}),
    ping: jest.fn(async () => "PONG"),
  };
  return {
    getRedis: () => redis,
    getPubClient: () => redis,
    getSubClient: () => redis,
    checkRedis: jest.fn(async () => ({ ok: true })),
    closeRedis: jest.fn(async () => {}),
  };
});

jest.mock("../email.service", () => ({
  emailResetPassword: jest.fn(async () => ({ messageId: "x" })),
  kirimEmail: jest.fn(async () => ({ messageId: "x" })),
}));

const bcrypt = require("bcrypt");
const { prisma } = require("../../config/database");
const auth = require("../auth.service");

describe("auth.service.login", () => {
  let pwHash;

  beforeAll(async () => {
    pwHash = await bcrypt.hash("Admin@123!", 10);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("user tidak ditemukan -> error 401", async () => {
    prisma.pengguna.findFirst.mockResolvedValue(null);
    await expect(auth.login({ identifier: "tidakada", password: "x" })).rejects.toMatchObject({ statusCode: 401 });
  });

  test("user nonaktif -> error 403", async () => {
    prisma.pengguna.findFirst.mockResolvedValue({ id: "u1", username: "u", email: "u@b.id", passwordHash: pwHash, statusAktif: false });
    await expect(auth.login({ identifier: "u", password: "Admin@123!" })).rejects.toMatchObject({ statusCode: 403 });
  });

  test("password salah -> 401, dan setelah 5 percobaan -> lockout 423", async () => {
    prisma.pengguna.findFirst.mockResolvedValue({ id: "u2", username: "u", email: "u@b.id", passwordHash: pwHash, statusAktif: true });
    for (let i = 0; i < 4; i++) {
      await expect(auth.login({ identifier: "u", password: "salah" })).rejects.toMatchObject({ statusCode: 401 });
    }
    await expect(auth.login({ identifier: "u", password: "salah" })).rejects.toMatchObject({ statusCode: 423 });
  });

  test("password benar -> mengembalikan accessToken & refreshToken", async () => {
    prisma.pengguna.findFirst.mockResolvedValue({
      id: "u3", username: "admin", email: "a@b.id", namaLengkap: "Admin",
      passwordHash: pwHash, peran: "ADMIN", statusAktif: true,
    });
    prisma.pengguna.update.mockResolvedValue({});
    const r = await auth.login({ identifier: "admin", password: "Admin@123!" });
    expect(r.accessToken).toBeDefined();
    expect(r.refreshToken).toBeDefined();
    expect(r.user.peran).toBe("ADMIN");
  });

  test("missing input", async () => {
    await expect(auth.login({})).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe("auth.service.refreshAccessToken", () => {
  test("token kosong -> 401", async () => {
    await expect(auth.refreshAccessToken(null)).rejects.toMatchObject({ statusCode: 401 });
  });

  test("token invalid -> 401", async () => {
    await expect(auth.refreshAccessToken("garbage")).rejects.toMatchObject({ statusCode: 401 });
  });
});
