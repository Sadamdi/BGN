import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ConfigProvider, App as AntApp } from "antd";
import idID from "antd/locale/id_ID";
import "antd/dist/reset.css";
import "leaflet/dist/leaflet.css";
import "./index.css";

import App from "./App.jsx";

const theme = {
  token: {
    colorPrimary: "#1D4ED8",
    colorInfo: "#1D4ED8",
    colorSuccess: "#52c41a",
    colorWarning: "#faad14",
    colorError: "#ff4d4f",
    colorBgLayout: "#F3F6FB",
    colorBgContainer: "#FFFFFF",
    colorText: "#0F172A",
    borderRadius: 12,
    borderRadiusLG: 16,
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
    boxShadowSecondary: "0 10px 30px rgba(15, 23, 42, 0.08)",
  },
  components: {
    Layout: {
      siderBg: "#0F172A",
      headerBg: "#ffffff",
      bodyBg: "#F3F6FB",
    },
    Menu: {
      darkItemBg: "#0F172A",
      darkSubMenuItemBg: "#111827",
      darkItemSelectedBg: "#1D4ED8",
    },
    Card: {
      borderRadiusLG: 16,
    },
    Button: {
      borderRadius: 10,
    },
  },
};

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ConfigProvider locale={idID} theme={theme}>
      <AntApp>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </AntApp>
    </ConfigProvider>
  </React.StrictMode>
);
