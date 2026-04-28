"use strict";

const { parsePagination, buildPaginationMeta } = require("../pagination");

describe("pagination utility", () => {
  test("default value", () => {
    const r = parsePagination({});
    expect(r.page).toBe(1);
    expect(r.limit).toBe(50);
    expect(r.skip).toBe(0);
  });

  test("custom value", () => {
    const r = parsePagination({ page: "3", limit: "20" });
    expect(r.page).toBe(3);
    expect(r.limit).toBe(20);
    expect(r.skip).toBe(40);
  });

  test("limit dibatasi maxLimit", () => {
    const r = parsePagination({ limit: "5000" }, { maxLimit: 200 });
    expect(r.limit).toBe(200);
  });

  test("page minimal 1", () => {
    const r = parsePagination({ page: "-5" });
    expect(r.page).toBe(1);
  });

  test("buildPaginationMeta", () => {
    expect(buildPaginationMeta({ total: 100, page: 2, limit: 25 })).toEqual({
      total: 100,
      page: 2,
      limit: 25,
      totalPages: 4,
    });
    expect(buildPaginationMeta({ total: 0, page: 1, limit: 25 }).totalPages).toBe(1);
  });
});
