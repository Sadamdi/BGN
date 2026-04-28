"use strict";

const { sanitizeString, safeNik, pick } = require("../sanitize");

describe("sanitize utility", () => {
  test("sanitizeString trim dan strip control chars", () => {
    expect(sanitizeString("  hello\u0000world  ")).toBe("helloworld");
  });
  test("sanitizeString memotong sesuai maxLength", () => {
    expect(sanitizeString("abcdefgh", { maxLength: 4 })).toBe("abcd");
  });
  test("safeNik hanya mengambil digit dan max 16", () => {
    expect(safeNik("32 0123-4567-8901-2345-extra")).toBe("3201234567890123");
  });
  test("pick mengembalikan subset", () => {
    expect(pick({ a: 1, b: 2, c: 3 }, ["a", "c"])).toEqual({ a: 1, c: 3 });
  });
});
