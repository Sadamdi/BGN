"use strict";

const { sukses, gagal } = require("../response");

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe("response helper", () => {
  test("sukses default status 200 dan struktur konsisten", () => {
    const res = mockRes();
    sukses(res, { a: 1 });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, message: "Berhasil", data: { a: 1 } }));
  });

  test("sukses extra field di-spread", () => {
    const res = mockRes();
    sukses(res, [1, 2, 3], "OK", 201, { pagination: { total: 3 } });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, pagination: { total: 3 } }));
  });

  test("gagal memuat code dan message", () => {
    const res = mockRes();
    gagal(res, "Validasi gagal", 422, "VALIDATION_ERROR");
    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false, code: "VALIDATION_ERROR", message: "Validasi gagal" }));
  });
});
