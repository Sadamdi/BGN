import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ConfigProvider, App as AntApp, theme as antdTheme } from "antd";
import idID from "antd/locale/id_ID";
import "antd/dist/reset.css";
import "leaflet/dist/leaflet.css";
import "./index.css";

import App from "./App.jsx";
import { useThemeStore, THEME_MODE } from "./store/themeStore";
import { useAuthStore } from "./store/authStore";

function AppThemeProvider({ children }) {
  const { themeMode, resolvedTheme, syncSystemTheme, applyThemeMode } = useThemeStore();
  const user = useAuthStore((s) => s.user);
  const isDark = resolvedTheme === THEME_MODE.DARK;

  React.useEffect(() => {
    const pref = user && user.themePreference;
    if (!pref || !Object.values(THEME_MODE).includes(pref)) return;
    if (pref !== themeMode) {
      applyThemeMode(pref);
    }
  }, [user, themeMode, applyThemeMode]);

  React.useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    root.setAttribute("data-theme-mode", themeMode.toLowerCase());
    root.setAttribute("data-theme-resolved", resolvedTheme.toLowerCase());
    body.classList.toggle("theme-dark", isDark);
    body.classList.toggle("theme-light", !isDark);
  }, [themeMode, resolvedTheme, isDark]);

  React.useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return undefined;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => syncSystemTheme();
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [syncSystemTheme]);

  const themeConfig = React.useMemo(
    () => ({
      algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
      token: {
        colorPrimary: "#1D4ED8",
        colorInfo: "#1D4ED8",
        colorSuccess: "#52c41a",
        colorWarning: "#faad14",
        colorError: "#ff4d4f",
        borderRadius: 12,
        borderRadiusLG: 16,
        fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
        boxShadowSecondary: isDark
          ? "0 10px 30px rgba(2, 6, 23, 0.45)"
          : "0 10px 30px rgba(15, 23, 42, 0.08)",
      },
      components: {
        Layout: {
          siderBg: isDark ? "#0B1220" : "#0F172A",
          headerBg: isDark ? "#0f172a" : "#ffffff",
          bodyBg: isDark ? "#020617" : "#F3F6FB",
        },
        Menu: {
          darkItemBg: isDark ? "#0B1220" : "#0F172A",
          darkSubMenuItemBg: isDark ? "#111827" : "#111827",
          darkItemSelectedBg: "#1D4ED8",
        },
        Card: {
          borderRadiusLG: 16,
        },
        Button: {
          borderRadius: 10,
        },
      },
    }),
    [isDark]
  );

  return (
    <ConfigProvider locale={idID} theme={themeConfig}>
      <AntApp>{children}</AntApp>
    </ConfigProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AppThemeProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </AppThemeProvider>
  </React.StrictMode>
);
