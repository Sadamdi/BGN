"use strict";

function parsePagination(query, { defaultLimit = 50, maxLimit = 200 } = {}) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limitRaw = parseInt(query.limit, 10) || defaultLimit;
  const limit = Math.min(Math.max(1, limitRaw), maxLimit);
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

function buildPaginationMeta({ total, page, limit }) {
  return {
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

module.exports = { parsePagination, buildPaginationMeta };
