import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Form, Input, Button, Card, Typography, Alert, App } from "antd";
import * as authApi from "../api/auth.api";

const { Title } = Typography;

export default function ResetPasswordPage() {
  const { token } = useParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const { message } = App.useApp();

  const onFinish = async (values) => {
    if (values.password !== values.konfirmasi) {
      setError("Konfirmasi password tidak sama");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await authApi.resetPassword(token, values.password);
      message.success("Password berhasil direset. Silakan login.");
      navigate("/login");
    } catch (err) {
      setError((err.response && err.response.data && err.response.data.message) || "Gagal reset password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F5F7FA" }}>
      <Card style={{ width: 420 }}>
        <Title level={4}>Reset Password</Title>
        {error ? <Alert type="error" message={error} showIcon style={{ marginBottom: 12 }} /> : null}
        <Form layout="vertical" onFinish={onFinish}>
          <Form.Item name="password" label="Password baru" rules={[{ required: true, min: 8, message: "Minimal 8 karakter" }]}>
            <Input.Password />
          </Form.Item>
          <Form.Item name="konfirmasi" label="Konfirmasi password" rules={[{ required: true }]}>
            <Input.Password />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={loading} block>
            Simpan
          </Button>
        </Form>
      </Card>
    </div>
  );
}
