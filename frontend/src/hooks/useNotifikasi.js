import { useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { notification } from "antd";
import { useAuthStore } from "../store/authStore";
import { useNotifikasiStore } from "../store/notifikasiStore";
import * as notifApi from "../api/notifikasi.api";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || (import.meta.env.DEV ? "http://localhost:3000" : window.location.origin);

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
      transports: ["websocket", "polling"],
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

    return () => {
      try {
        s.disconnect();
      } catch (_) {}
    };
  }, [isAuthenticated, accessToken, tambah]);

  return sockRef.current;
}
