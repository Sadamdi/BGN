"use strict";

const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const { ACCESS_SECRET } = require("../config/jwt");

let io = null;

function initSocket(httpServer) {
  if (io) return io;
  const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
  io = new Server(httpServer, {
    cors: {
      origin: FRONTEND_URL.split(",").map((s) => s.trim()),
      credentials: true,
    },
  });

  io.use((socket, next) => {
    try {
      const token =
        (socket.handshake.auth && socket.handshake.auth.token) ||
        (socket.handshake.query && socket.handshake.query.token);
      if (!token) return next(new Error("UNAUTHENTICATED"));
      const payload = jwt.verify(token, ACCESS_SECRET);
      socket.user = payload;
      next();
    } catch (err) {
      next(new Error("TOKEN_INVALID"));
    }
  });

  io.on("connection", (socket) => {
    const u = socket.user || {};
    socket.join("user:" + u.userId);
    socket.join("peran:" + u.peran);
    if (u.sppgId) socket.join("sppg:" + u.sppgId);
    if (u.wilayahZona) socket.join("zona:" + u.wilayahZona);

    socket.on("join-room", (room) => {
      if (typeof room === "string" && room.length < 80) {
        socket.join(room);
      }
    });

    socket.on("disconnect", () => {});
  });

  return io;
}

function getIO() {
  return io;
}

function emitToUser(userId, event, data) {
  if (!io) return;
  io.to("user:" + userId).emit(event, data);
}

function emitToRoom(room, event, data) {
  if (!io) return;
  io.to(room).emit(event, data);
}

function emitToZona(zona, event, data) {
  if (!io || !zona) return;
  io.to("zona:" + zona).emit(event, data);
}

function emitToPeran(peran, event, data) {
  if (!io) return;
  io.to("peran:" + peran).emit(event, data);
}

module.exports = {
  initSocket,
  getIO,
  emitToUser,
  emitToRoom,
  emitToZona,
  emitToPeran,
};
