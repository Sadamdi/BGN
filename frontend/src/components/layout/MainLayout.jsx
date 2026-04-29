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
  Grid,
  Skeleton,
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
import logoIcon from "../../Media/Logo.png";
import brandBanner from "../../Media/Banner Logo.png";
import ThemeToggleButton from "../theme/ThemeToggleButton";

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
  const { token } = antdTheme.useToken();
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.lg;
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [contentLoading, setContentLoading] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, clearSession } = useAuthStore();
  const jumlahBelum = useNotifikasiStore((s) => s.jumlahBelumDibaca);
  useNotifikasi();

  useEffect(() => {
    const syncCollapsed = () => {
      setCollapsed(window.innerWidth < 992);
    };
    syncCollapsed();
    window.addEventListener("resize", syncCollapsed);
    return () => window.removeEventListener("resize", syncCollapsed);
  }, []);

  useEffect(() => {
    setContentLoading(true);
    const timer = window.setTimeout(() => setContentLoading(false), 180);
    return () => window.clearTimeout(timer);
  }, [location.pathname]);

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
            color: token.colorTextLightSolid,
            fontWeight: 800,
            letterSpacing: 1,
            padding: collapsed ? "20px 8px" : "20px 16px",
            fontSize: collapsed ? 12 : 18,
            textAlign: collapsed ? "center" : "left",
            borderBottom: "1px solid #1f2937",
          }}
        >
          {collapsed ? (
            <img
              src={logoIcon}
              alt="Logo Badan Gizi Nasional"
              style={{ width: 32, height: 32, objectFit: "contain", borderRadius: "50%" }}
            />
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <img
                src={brandBanner}
                alt="Banner Badan Gizi Nasional"
                style={{ width: "100%", maxWidth: 170, objectFit: "contain", display: "block" }}
              />
            </div>
          )}
        </div>
        <Menu theme="dark" mode="inline" selectedKeys={[location.pathname]} items={items} />
      </Sider>
      <Layout>
        <Header
          style={{
            padding: isMobile ? "0 10px" : "0 16px",
            background: token.colorBgContainer,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
            boxShadow: "0 4px 14px rgba(15, 23, 42, 0.04)",
          }}
        >
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
          />
          <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 8 : 12 }}>
            <ThemeToggleButton size={isMobile ? "middle" : "small"} />
            <Badge count={jumlahBelum} overflowCount={99}>
              <Button shape="circle" icon={<BellOutlined />} onClick={() => setDrawerOpen(true)} />
            </Badge>
            <Dropdown menu={profileMenu} trigger={["click"]}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <Avatar style={{ backgroundColor: token.colorPrimary }}>
                  {user && user.namaLengkap ? user.namaLengkap.charAt(0) : "U"}
                </Avatar>
                {!isMobile ? (
                  <div style={{ lineHeight: 1.2, maxWidth: 180, minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: 600,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                      title={(user && user.namaLengkap) || ""}
                    >
                      {user && user.namaLengkap}
                    </div>
                    <Tag color={PERAN_COLOR[peran]} style={{ marginRight: 0 }}>
                      {PERAN_LABEL[peran] || peran}
                    </Tag>
                  </div>
                ) : null}
              </div>
            </Dropdown>
          </div>
        </Header>
        <Content style={{ padding: isMobile ? 12 : 24, background: token.colorBgLayout }}>
          <div key={location.pathname} className="route-fade-enter">
            {contentLoading ? (
              <div className="page-transition-shell">
                <Skeleton active paragraph={{ rows: isMobile ? 6 : 8 }} title={{ width: "38%" }} />
              </div>
            ) : (
              <Outlet />
            )}
          </div>
        </Content>
        <Footer style={{ textAlign: "center", color: token.colorTextSecondary }}>
          SIPGN-BGN © {new Date().getFullYear()} Badan Gizi Nasional — Sistem Informasi Pemenuhan Gizi Nasional
          <span style={{ marginLeft: 8, fontSize: 11 }}>v{import.meta.env.VITE_APP_VERSION || "1.0.0"}</span>
        </Footer>
      </Layout>
      <NotificationDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </Layout>
  );
}
