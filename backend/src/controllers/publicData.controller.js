"use strict";

const { prisma } = require("../config/database");
const { sukses } = require("../utils/response");

async function getRingkasanPublik(req, res, next) {
  try {
    const tahun = parseInt(req.query.tahun, 10) || new Date().getFullYear();
    const data = await prisma.indikatorPublik.findMany({
      where: { tahun },
      include: {
        sumber: {
          select: {
            slug: true,
            nama: true,
          },
        },
      },
      orderBy: [{ kategori: "asc" }, { indikator: "asc" }],
      take: 500,
    });
    return sukses(res, data, "Ringkasan data publik berhasil dimuat");
  } catch (err) {
    return next(err);
  }
}

async function getRealtimeSummary(_req, res, next) {
  try {
    const today = new Date();
    const metrics = await prisma.realtimeMetric.findMany({
      where: {
        dateJakarta: {
          gte: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    const grouped = {};
    for (const m of metrics) {
      grouped[m.metricKey] = (grouped[m.metricKey] || 0) + m.delta;
    }
    const last = metrics[0]?.generatedAt || null;
    return sukses(
      res,
      {
        timezone: "Asia/Jakarta",
        updatedAt: last,
        values: grouped,
      },
      "Ringkasan realtime MBG berhasil dimuat"
    );
  } catch (err) {
    return next(err);
  }
}

async function realtimeStream(req, res, next) {
  try {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    let closed = false;
    req.on("close", () => {
      closed = true;
    });

    let lastSentIso = null;
    const sendEvents = async () => {
      const items = await prisma.realtimeEventStream.findMany({
        where: lastSentIso
          ? { createdAt: { gt: new Date(lastSentIso) } }
          : undefined,
        orderBy: { createdAt: "asc" },
        take: 20,
      });
      for (const item of items) {
        res.write(`event: ${item.eventType}\n`);
        res.write(`data: ${JSON.stringify(item.payload)}\n\n`);
        lastSentIso = item.createdAt.toISOString();
      }
      if (items.length === 0) {
        res.write(`event: ping\ndata: {"ts":"${new Date().toISOString()}"}\n\n`);
      }
    };

    const id = setInterval(async () => {
      if (closed) {
        clearInterval(id);
        return;
      }
      try {
        await sendEvents();
      } catch (_) {}
    }, 5000);

    await sendEvents();
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  getRingkasanPublik,
  getRealtimeSummary,
  realtimeStream,
};
