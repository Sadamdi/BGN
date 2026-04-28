"use strict";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-jwt-secret-min-32-chars-aaaaa";
process.env.JWT_REFRESH_SECRET = "test-jwt-refresh-secret-aaaaaaa";
process.env.DATA_ENCRYPTION_KEY = "unit-test-key-please-change-1234567890";

const findManyMock = jest.fn();
const countMock = jest.fn();
const createMock = jest.fn();

jest.mock("../../config/database", () => ({
  prisma: {
    penerimaManfaat: {
      findMany: (...a) => findManyMock(...a),
      count: (...a) => countMock(...a),
      create: (...a) => createMock(...a),
    },
    auditTrail: { create: jest.fn(async () => ({})) },
    sppg: { findUnique: jest.fn() },
  },
  checkDatabase: jest.fn(async () => ({ ok: true })),
}));

jest.mock("../../config/redis", () => {
  const store = new Map();
  const redis = {
    get: jest.fn(async (k) => (store.has(k) ? store.get(k) : null)),
    set: jest.fn(async () => "OK"),
    del: jest.fn(async () => 1),
    scan: jest.fn(async () => ["0", []]),
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

const request = require("supertest");
const jwt = require("jsonwebtoken");
const { buildApp } = require("../../app");
const { ACCESS_SECRET } = require("../../config/jwt");

const app = buildApp();

function tokenFor(user) {
  return jwt.sign(user, ACCESS_SECRET, { expiresIn: "1h" });
}

describe("GET /api/penerima", () => {
  beforeEach(() => {
    findManyMock.mockReset();
    countMock.mockReset();
    createMock.mockReset();
  });

  test("401 tanpa token", async () => {
    const r = await request(app).get("/api/penerima");
    expect(r.status).toBe(401);
  });

  test("200 untuk OPERATOR_SPPG, hanya filter sppgId sendiri", async () => {
    findManyMock.mockResolvedValue([]);
    countMock.mockResolvedValue(0);
    const token = tokenFor({ userId: "u1", username: "op", peran: "OPERATOR_SPPG", sppgId: "sp1", namaLengkap: "Op" });
    const r = await request(app).get("/api/penerima").set("Authorization", "Bearer " + token);
    expect(r.status).toBe(200);
    expect(findManyMock).toHaveBeenCalled();
    const args = findManyMock.mock.calls[0][0];
    expect(args.where.sppgId).toBe("sp1");
  });

  test("403 untuk PENGAWAS membuat penerima (tidak diizinkan)", async () => {
    const token = tokenFor({ userId: "u1", username: "p", peran: "PENGAWAS_GIZI", wilayahZona: "DKI Jakarta", namaLengkap: "P" });
    const r = await request(app).post("/api/penerima").set("Authorization", "Bearer " + token).send({});
    expect(r.status).toBe(403);
  });

  test("422 jika body tanpa NIK", async () => {
    const token = tokenFor({ userId: "u1", username: "op", peran: "OPERATOR_SPPG", sppgId: "sp1", namaLengkap: "Op" });
    const r = await request(app).post("/api/penerima").set("Authorization", "Bearer " + token).send({
      namaLengkap: "Test",
      tanggalLahir: new Date().toISOString(),
      jenisKelamin: "LAKI_LAKI",
      kategori: "BALITA",
    });
    expect(r.status).toBe(422);
  });

  test("201 untuk OPERATOR menambahkan penerima dengan data valid", async () => {
    createMock.mockResolvedValue({ id: "p1", namaLengkap: "Andi", nikMasked: "1234********9012" });
    const token = tokenFor({ userId: "u1", username: "op", peran: "OPERATOR_SPPG", sppgId: "sp1", namaLengkap: "Op" });
    const tanggalLahir = new Date(Date.now() - 24 * 30 * 24 * 60 * 60 * 1000).toISOString();
    const r = await request(app)
      .post("/api/penerima")
      .set("Authorization", "Bearer " + token)
      .send({
        nik: "1234567890129012",
        namaLengkap: "Andi",
        tanggalLahir,
        jenisKelamin: "LAKI_LAKI",
        kategori: "BALITA",
      });
    expect(r.status).toBe(201);
    expect(createMock).toHaveBeenCalled();
  });
});
