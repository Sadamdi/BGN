import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Form, Input, Button, Card, Typography, Alert, App, Space } from "antd";
import * as authApi from "../api/auth.api";

const { Title } = Typography;

export default function ResetPasswordPage() {
  const [form] = Form.useForm();
  const { token } = useParams();
  const [loading, setLoading] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [otpValid, setOtpValid] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const { message } = App.useApp();

  const onFinish = async (values) => {
    if (!otpValid) {
      setError("Verifikasi OTP terlebih dahulu");
      return;
    }
    if (values.password !== values.konfirmasi) {
      setError("Konfirmasi password tidak sama");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await authApi.resetPassword(token, values.password, values.otp);
      message.success("Password berhasil direset. Silakan login.");
      navigate("/login");
    } catch (err) {
      setError((err.response && err.response.data && err.response.data.message) || "Gagal reset password");
    } finally {
      setLoading(false);
    }
  };

  const onVerifyOtp = async () => {
    const val = form.getFieldValue("otp");
    if (!val || String(val).length < 6) {
      setError("OTP wajib diisi 6 digit");
      return;
    }
    setVerifyingOtp(true);
    setError(null);
    try {
      await authApi.verifyResetOtp(token, val);
      setOtpValid(true);
      message.success("OTP valid");
    } catch (err) {
      setOtpValid(false);
      setError((err.response && err.response.data && err.response.data.message) || "OTP tidak valid");
    } finally {
      setVerifyingOtp(false);
    }
  };

  return (
    <div className="auth-screen">
      <Card style={{ width: "100%", maxWidth: 440 }} className="auth-card">
        <Title level={4}>Reset Password + OTP</Title>
        {error ? <Alert type="error" message={error} showIcon style={{ marginBottom: 12 }} /> : null}
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item name="otp" label="OTP (6 digit)" rules={[{ required: true, message: "OTP wajib diisi" }]}>
            <Input placeholder="Contoh: 123456" maxLength={6} onChange={() => setOtpValid(false)} />
          </Form.Item>
          <Space wrap style={{ marginBottom: 12 }}>
            <Button onClick={onVerifyOtp} loading={verifyingOtp}>Verifikasi OTP</Button>
            {otpValid ? <span style={{ color: "#16a34a" }}>OTP tervalidasi</span> : null}
          </Space>
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
