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
    colorPrimary: "#1B3A6B",
    colorSuccess: "#52c41a",
    colorWarning: "#faad14",
    colorError: "#ff4d4f",
    borderRadius: 8,
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
  },
  components: {
    Layout: {
      siderBg: "#1B3A6B",
      headerBg: "#ffffff",
      bodyBg: "#F5F7FA",
    },
    Menu: {
      darkItemBg: "#1B3A6B",
      darkSubMenuItemBg: "#142b51",
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
