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
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 className="bgn-page-title text-clamp-2" title={title}>{title}</h1>
          {subtitle ? (
            <div className="text-clamp-2" style={{ color: token.colorTextSecondary, marginTop: 4, fontSize: 13 }} title={subtitle}>
              {subtitle}
            </div>
          ) : null}
        </div>
        {actions ? <Space wrap style={{ flexShrink: 0 }}>{actions}</Space> : null}
      </div>
    </div>
  );
}
