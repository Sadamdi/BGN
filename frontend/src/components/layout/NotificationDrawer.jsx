import React from "react";
import { Drawer, List, Tag, Button, Empty, Typography } from "antd";
import dayjs from "dayjs";
import { useNotifikasiStore } from "../../store/notifikasiStore";
import * as notifApi from "../../api/notifikasi.api";

const JENIS_LABEL = {
  DISTRIBUSI_BARU: { label: "Distribusi", color: "blue" },
  GIZI_BURUK: { label: "Gizi", color: "red" },
  SPPG_BELUM_LAPOR: { label: "SPPG", color: "orange" },
  DISTRIBUSI_RENDAH: { label: "Realisasi", color: "gold" },
};

export default function NotificationDrawer({ open, onClose }) {
  const items = useNotifikasiStore((s) => s.items);
  const tandaiSemuaDibaca = useNotifikasiStore((s) => s.tandaiSemuaDibaca);

  const onTandaiSemua = async () => {
    try {
      await notifApi.tandaiSemua();
    } catch (_) {}
    tandaiSemuaDibaca();
  };

  return (
    <Drawer
      title="Notifikasi"
      placement="right"
      onClose={onClose}
      open={open}
      width={420}
      extra={
        <Button size="small" onClick={onTandaiSemua} disabled={!items.some((n) => !n.dibaca)}>
          Tandai semua dibaca
        </Button>
      }
    >
      {items.length === 0 ? (
        <Empty description="Belum ada notifikasi" />
      ) : (
        <List
          dataSource={items}
          renderItem={(n) => {
            const meta = JENIS_LABEL[n.jenis] || { label: "Info", color: "default" };
            return (
              <List.Item style={{ background: n.dibaca ? "transparent" : "#F0F4FF", borderRadius: 8, padding: 12 }}>
                <List.Item.Meta
                  title={
                    <span>
                      <Tag color={meta.color}>{meta.label}</Tag>
                      <Typography.Text strong>{n.judul}</Typography.Text>
                    </span>
                  }
                  description={
                    <>
                      <div>{n.pesan}</div>
                      <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>
                        {dayjs(n.createdAt).format("DD MMM YYYY HH:mm")}
                      </div>
                    </>
                  }
                />
              </List.Item>
            );
          }}
        />
      )}
    </Drawer>
  );
}
