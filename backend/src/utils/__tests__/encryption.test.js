"use strict";

process.env.DATA_ENCRYPTION_KEY = "unit-test-key-please-change-1234567890";

const { encryptText, decryptText, hashIndex, maskNik } = require("../encryption");

describe("Encryption utility (PDP)", () => {
  test("encrypt -> decrypt round trip menghasilkan plaintext yang sama", () => {
    const plain = "1234567890123456";
    const enc = encryptText(plain);
    expect(typeof enc).toBe("string");
    expect(enc).not.toBe(plain);
    expect(decryptText(enc)).toBe(plain);
  });

  test("encrypt menghasilkan ciphertext berbeda pada setiap pemanggilan (IV acak)", () => {
    const a = encryptText("nilai-yg-sama");
    const b = encryptText("nilai-yg-sama");
    expect(a).not.toBe(b);
    expect(decryptText(a)).toBe(decryptText(b));
  });

  test("hashIndex deterministik dan tidak reversible", () => {
    const h1 = hashIndex("3201234567890123");
    const h2 = hashIndex("3201234567890123");
    expect(h1).toBe(h2);
    expect(h1.length).toBe(64);
    expect(h1).not.toContain("3201");
  });

  test("maskNik menampilkan 4 prefix + 4 suffix", () => {
    expect(maskNik("3201234567890123")).toBe("3201********0123");
  });

  test("decryptText untuk input invalid mengembalikan null", () => {
    expect(decryptText("bukan-base64-valid")).toBeNull();
    expect(decryptText("")).toBeNull();
    expect(decryptText(null)).toBeNull();
  });

  test("encryptText untuk null mengembalikan null", () => {
    expect(encryptText(null)).toBeNull();
    expect(encryptText(undefined)).toBeNull();
  });
});
