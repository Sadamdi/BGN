"use strict";

const dayjs = require("dayjs");

function startOfDay(d) {
  return dayjs(d).startOf("day").toDate();
}

function endOfDay(d) {
  return dayjs(d).endOf("day").toDate();
}

function rangeArray(days) {
  const out = [];
  const today = dayjs().startOf("day");
  for (let i = days - 1; i >= 0; i--) {
    out.push(today.subtract(i, "day").format("YYYY-MM-DD"));
  }
  return out;
}

module.exports = { startOfDay, endOfDay, rangeArray };
