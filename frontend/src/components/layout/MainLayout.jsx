import React, { useState, useMemo, useEffect } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import {
  Layout,
  Menu,
  Avatar,
  Dropdown,
  Badge,
  Button,
  Tag,
  theme as antdTheme,
} from "antd";
import {
  DashboardOutlined,
  TeamOutlined,
  CarOutlined,
  HeartOutlined,
  FileTextOutlined,
  BankOutlined,
  SafetyOutlined,
  BellOutlined,
  LogoutOutlined,
  UserOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from "@ant-design/icons";

import { useAuthStore } from "../../store/authStore";
import { useNotifikasiStore } from "../../store/notifikasiStore";
import useNotifikasi from "../../hooks/useNotifikasi";
import * as authApi from "../../api/auth.api";
import NotificationDrawer from "./NotificationDrawer";

const { Sider, Header, Content, Footer } = Layout;

const PERAN_COLOR = {
  ADMIN: "magenta",
  PEJABAT_BGN: "purple",
  PENGAWAS_GIZI: "blue",
  OPERATOR_SPPG: "green",
  ASISTEN_LAPANGAN: "cyan",
};

const PERAN_LABEL = {
  ADMIN: "Administrator",
  PEJABAT_BGN: "Pejabat BGN",
  PENGAWAS_GIZI: "Pengawas Gizi",
  OPERATOR_SPPG: "Operator SPPG",
  ASISTEN_LAPANGAN: "Asisten Lapangan",
};

function buildMenu(peran) {
  const items = [
    { key: "/dashboard", icon: <DashboardOutlined />, label: <Link to="/dashboard">Dashboard</Link> },
  ];

  if (["ADMIN", "PEJABAT_BGN", "PENGAWAS_GIZI", "OPERATOR_SPPG", "ASISTEN_LAPANGAN"].includes(peran)) {
    items.push({ key: "/penerima", icon: <TeamOutlined />, label: <Link to="/penerima">Penerima Manfaat</Link> });
    items.push({ key: "/distribusi", icon: <CarOutlined />, label: <Link to="/distribusi">Distribusi MBG</Link> });
  }
  if (["ADMIN", "PEJABAT_BGN", "PENGAWAS_GIZI", "OPERATOR_SPPG"].includes(peran)) {
    items.push({ key: "/gizi", icon: <HeartOutlined />, label: <Link to="/gizi">Status Gizi</Link> });
  }
  if (["ADMIN", "PEJABAT_BGN", "PENGAWAS_GIZI", "OPERATOR_SPPG"].includes(peran)) {
    items.push({ key: "/laporan", icon: <FileTextOutlined />, label: <Link to="/laporan">Laporan</Link> });
  }
  if (["ADMIN", "PEJABAT_BGN", "PENGAWAS_GIZI"].includes(peran)) {
    items.push({ key: "/sppg", icon: <BankOutlined />, label: <Link to="/sppg">SPPG</Link> });
  }
  if (peran === "ADMIN") {
    items.push({ key: "/pengguna", icon: <SafetyOutlined />, label: <Link to="/pengguna">Pengguna Sistem</Link> });
  }
  items.push({ key: "/profil", icon: <UserOutlined />, label: <Link to="/profil">Profil</Link> });
  return items;
}

export default function MainLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, clearSession } = useAuthStore();
  const jumlahBelum = useNotifikasiStore((s) => s.jumlahBelumDibaca);
  useNotifikasi();

  useEffect(() => {
    if (window.innerWidth < 992) setCollapsed(true);
  }, []);

  const items = useMemo(() => buildMenu((user && user.peran) || ""), [user]);

  const onLogout = async () => {
    try {
      await authApi.logout();
    } catch (_) {}
    clearSession();
    navigate("/login");
  };

  const profileMenu = {
    items: [
      { key: "profil", label: <Link to="/profil">Profil saya</Link>, icon: <UserOutlined /> },
      { type: "divider" },
      { key: "logout", label: "Keluar", icon: <LogoutOutlined />, onClick: onLogout },
    ],
  };

  const peran = (user && user.peran) || "";

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider collapsible collapsed={collapsed} onCollapse={setCollapsed} breakpoint="lg" trigger={null} width={236}>
        <div
          style={{
            color: "#fff",
            fontWeight: 800,
            letterSpacing: 1,
            padding: collapsed ? "20px 8px" : "20px 16px",
            fontSize: collapsed ? 12 : 18,
            textAlign: collapsed ? "center" : "left",
            borderBottom: "1px solid #142b51",
          }}
        >
          {collapsed ? "BGN" : "SIPGN-BGN"}
          {!collapsed ? (
            <div style={{ fontSize: 11, fontWeight: 400, color: "#cbd5e1", marginTop: 2 }}>
              Pemenuhan Gizi Nasional
            </div>
          ) : null}
        </div>
        <Menu theme="dark" mode="inline" selectedKeys={[location.pathname]} items={items} />
      </Sider>
      <Layout>
        <Header
          style={{
            padding: "0 16px",
            background: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid #e2e8f0",
          }}
        >
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Badge count={jumlahBelum} overflowCount={99}>
              <Button shape="circle" icon={<BellOutlined />} onClick={() => setDrawerOpen(true)} />
            </Badge>
            <Dropdown menu={profileMenu} trigger={["click"]}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <Avatar style={{ backgroundColor: "#1B3A6B" }}>
                  {user && user.namaLengkap ? user.namaLengkap.charAt(0) : "U"}
                </Avatar>
                <div style={{ lineHeight: 1.2 }}>
                  <div style={{ fontWeight: 600 }}>{user && user.namaLengkap}</div>
                  <Tag color={PERAN_COLOR[peran]} style={{ marginRight: 0 }}>
                    {PERAN_LABEL[peran] || peran}
                  </Tag>
                </div>
              </div>
            </Dropdown>
          </div>
        </Header>
        <Content style={{ padding: 24, background: "#F5F7FA" }}>
          <Outlet />
        </Content>
        <Footer style={{ textAlign: "center", color: "#475569" }}>
          SIPGN-BGN © {new Date().getFullYear()} Badan Gizi Nasional — Sistem Informasi Pemenuhan Gizi Nasional
          <span style={{ marginLeft: 8, fontSize: 11 }}>v{import.meta.env.VITE_APP_VERSION || "1.0.0"}</span>
        </Footer>
      </Layout>
      <NotificationDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </Layout>
  );
}
