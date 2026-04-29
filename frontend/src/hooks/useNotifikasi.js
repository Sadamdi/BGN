import { useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { notification } from "antd";
import { useAuthStore } from "../store/authStore";
import { useNotifikasiStore } from "../store/notifikasiStore";
import * as notifApi from "../api/notifikasi.api";

function resolveSocketUrl() {
  const raw = import.meta.env.VITE_SOCKET_URL || (import.meta.env.DEV ? "http://localhost:3000" : window.location.origin);
  return String(raw).replace(/\/+$/, "").replace(/\/frontend$/i, "").replace(/\/api$/i, "");
}

const SOCKET_URL = resolveSocketUrl();

export default function useNotifikasi() {
  const { isAuthenticated, accessToken } = useAuthStore();
  const tambah = useNotifikasiStore((s) => s.tambahNotifikasi);
  const setNotifikasi = useNotifikasiStore((s) => s.setNotifikasi);
  const sockRef = useRef(null);

  useEffect(() => {
    if (!isAuthenticated || !accessToken) return;
    notifApi
      .list()
      .then((r) => {
        if (r && r.data) {
          setNotifikasi(r.data.items || [], r.data.jumlahBelumDibaca || 0);
        }
      })
      .catch(() => {});
  }, [isAuthenticated, accessToken, setNotifikasi]);

  useEffect(() => {
    if (!isAuthenticated || !accessToken) return;
    const s = io(SOCKET_URL, {
      auth: { token: accessToken },
      path: "/socket.io",
      transports: ["websocket"],
      reconnection: false,
      timeout: 8000,
    });
    sockRef.current = s;

    s.on("new-notification", (notif) => {
      tambah(notif);
      notification.open({
        message: notif.judul || "Notifikasi baru",
        description: notif.pesan,
        placement: "topRight",
        duration: 6,
      });
    });

    s.on("connect_error", () => {
      // Jangan spam reconnect/error di environment yang tidak support websocket.
      try {
        s.disconnect();
      } catch (_) {}
    });

    return () => {
      try {
        s.disconnect();
      } catch (_) {}
    };
  }, [isAuthenticated, accessToken, tambah]);

  return sockRef.current;
}
