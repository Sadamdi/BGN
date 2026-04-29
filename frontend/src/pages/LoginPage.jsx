import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Form, Input, Button, Checkbox, Modal, Alert, Typography, Card, App, theme as antdTheme } from "antd";
import { UserOutlined, LockOutlined, MailOutlined } from "@ant-design/icons";
import { useAuthStore } from "../store/authStore";
import * as authApi from "../api/auth.api";
import logoIcon from "../Media/Logo.png";
import brandBanner from "../Media/Banner Logo.png";

const { Title, Text } = Typography;

export default function LoginPage() {
  const { token } = antdTheme.useToken();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [forgotOpen, setForgotOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { setSession, isAuthenticated } = useAuthStore();
  const { message } = App.useApp();

  if (isAuthenticated) {
    return null;
  }

  const onFinish = async (values) => {
    setError(null);
    setLoading(true);
    try {
      const r = await authApi.login({
        username: values.identifier,
        email: values.identifier,
        password: values.password,
      });
      const data = r && r.data;
      if (!data || !data.accessToken) {
        throw new Error("Respon login tidak valid");
      }
      if (values.ingatSaya) {
        localStorage.setItem("sipgn-username", values.identifier);
      } else {
        localStorage.removeItem("sipgn-username");
      }
      setSession({
        user: data.user,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
      });
      const dest = (location.state && location.state.from && location.state.from.pathname) || "/dashboard";
      navigate(dest, { replace: true });
    } catch (err) {
      const msg = (err.response && err.response.data && err.response.data.message) || err.message || "Login gagal";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const onForgot = async (values) => {
    try {
      await authApi.forgotPassword(values.email);
      message.success("Jika email terdaftar, link reset password telah dikirim.");
      setForgotOpen(false);
    } catch (_) {
      message.success("Jika email terdaftar, link reset password telah dikirim.");
      setForgotOpen(false);
    }
  };

  return (
    <div className="auth-screen">
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          maxWidth: 620,
        }}
        className="bgn-login-side"
      >
        <div style={{ color: token.colorText, maxWidth: 520 }} className="auth-brand-panel">
          <img
            src={brandBanner}
            alt="Banner Badan Gizi Nasional"
            className="auth-brand-logo"
          />
          <Title level={2} style={{ color: token.colorText, marginBottom: 4 }}>
            SIPGN-BGN
          </Title>
          <Title level={4} style={{ color: token.colorTextHeading, marginTop: 0 }}>
            Sistem Informasi Pemenuhan Gizi Nasional
          </Title>
          <Text type="secondary">
            Badan Gizi Nasional — Program Makan Bergizi Gratis
          </Text>
          <p style={{ color: token.colorTextSecondary, marginTop: 24, fontSize: 14, lineHeight: 1.7 }}>
            Pantau distribusi MBG, kelola data penerima manfaat, dan analisis status gizi
            di seluruh SPPG Indonesia secara terpadu.
          </p>
        </div>
      </div>

      <div
        style={{
          width: "100%",
          maxWidth: 480,
          background: "transparent",
          padding: "24px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Card className="auth-card" style={{ width: "100%", maxWidth: 410 }}>
          <img
            src={logoIcon}
            alt="Logo Badan Gizi Nasional"
            className="auth-card-logo"
          />
          <Title level={3} style={{ marginBottom: 4 }}>
            Selamat datang
          </Title>
          <Text type="secondary">Masuk ke akun SIPGN-BGN Anda</Text>

          {error ? (
            <Alert type="error" showIcon message={error} style={{ marginTop: 16, marginBottom: 8 }} />
          ) : null}

          <Form
            form={form}
            layout="vertical"
            initialValues={{
              identifier: localStorage.getItem("sipgn-username") || "",
              ingatSaya: !!localStorage.getItem("sipgn-username"),
            }}
            onFinish={onFinish}
            style={{ marginTop: 16 }}
          >
            <Form.Item
              name="identifier"
              label="Username atau Email"
              rules={[{ required: true, message: "Wajib diisi" }]}
            >
              <Input prefix={<UserOutlined />} placeholder="Masukkan username atau email" autoComplete="username" />
            </Form.Item>
            <Form.Item
              name="password"
              label="Password"
              rules={[{ required: true, message: "Wajib diisi" }]}
            >
              <Input.Password prefix={<LockOutlined />} placeholder="Masukkan password" autoComplete="current-password" />
            </Form.Item>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
              <Form.Item name="ingatSaya" valuePropName="checked" noStyle>
                <Checkbox>Ingat saya</Checkbox>
              </Form.Item>
              <Button type="link" onClick={() => setForgotOpen(true)} style={{ padding: 0 }}>
                Lupa password?
              </Button>
            </div>

            <Button type="primary" htmlType="submit" block size="large" loading={loading}>
              Masuk
            </Button>
          </Form>
        </Card>
      </div>

      <Modal
        title="Lupa Password"
        open={forgotOpen}
        onCancel={() => setForgotOpen(false)}
        footer={null}
      >
        <Form layout="vertical" onFinish={onForgot}>
          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: "Email wajib diisi" },
              { type: "email", message: "Format email tidak valid" },
            ]}
          >
            <Input prefix={<MailOutlined />} placeholder="email@bgn.go.id" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block>
            Kirim Link Reset
          </Button>
        </Form>
      </Modal>
    </div>
  );
}
