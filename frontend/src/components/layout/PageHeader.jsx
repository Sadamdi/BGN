import React from "react";
import { Breadcrumb, Space, theme as antdTheme } from "antd";

export default function PageHeader({ title, subtitle, actions, breadcrumb }) {
  const { token } = antdTheme.useToken();
  return (
    <div style={{ marginBottom: 16 }}>
      {breadcrumb && breadcrumb.length > 0 ? (
        <Breadcrumb style={{ marginBottom: 8 }} items={breadcrumb.map((b) => ({ title: b }))} />
      ) : null}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1 className="bgn-page-title">{title}</h1>
          {subtitle ? (
            <div style={{ color: token.colorTextSecondary, marginTop: 4, fontSize: 13 }}>{subtitle}</div>
          ) : null}
        </div>
        {actions ? <Space wrap>{actions}</Space> : null}
      </div>
    </div>
  );
}
