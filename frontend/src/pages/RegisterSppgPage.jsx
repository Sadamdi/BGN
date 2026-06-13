import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Form, Input, InputNumber, Button, Alert, Typography, Card, Steps, App, theme as antdTheme, Result } from "antd";
import { UserOutlined, LockOutlined, MailOutlined, HomeOutlined, EnvironmentOutlined } from "@ant-design/icons";
import * as authApi from "../api/auth.api";
import logoIcon from "../Media/Logo.png";
import ThemeToggleButton from "../components/theme/ThemeToggleButton";

const { Title, Text } = Typography;

export default function RegisterSppgPage() {
  const { token } = antdTheme.useToken();
  const [form] = Form.useForm();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);
  const navigate = useNavigate();
  const { message } = App.useApp();

  const next = async () => {
    try {
      await form.validateFields(["kodeSppg", "namaSppg", "alamat", "provinsi", "kabupatenKota", "kapasitasPorsiPerHari"]);
      setStep(1);
    } catch (_) {
      /* validation errors shown inline */
    }
  };

  const onFinish = async (values) => {
    setError(null);
    setLoading(true);
    try {
      await authApi.registerSppg(values);
      setDone(true);
      message.success("Registrasi terkirim. Menunggu persetujuan admin.");
    } catch (err) {
      const data = err.response && err.response.data;
      const fieldErrs = data && data.fields;
      if (fieldErrs) {
        form.setFields(Object.keys(fieldErrs).map((name) => ({ name, errors: [fieldErrs[name]] })));
        // pindah ke step yang memuat error pertama
        if (["kodeSppg", "namaSppg", "alamat", "provinsi", "kabupatenKota", "kapasitasPorsiPerHari"].some((k) => fieldErrs[k])) {
          setStep(0);
        }
      }
      setError((data && data.message) || err.message || "Registrasi gagal");
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="auth-screen" style={{ alignItems: "center", justifyContent: "center" }}>
        <Card className="auth-card" style={{ maxWidth: 520 }}>
          <Result
            status="success"
            title="Registrasi SPPG Berhasil"
            subTitle="Akun operator SPPG Anda telah dibuat dan sedang menunggu persetujuan admin. Anda akan dapat login setelah disetujui."
            extra={[
              <Button type="primary" key="login" onClick={() => navigate("/login")}>
                Kembali ke Login
              </Button>,
            ]}
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="auth-screen" style={{ alignItems: "center", justifyContent: "center" }}>
      <div className="auth-theme-toggle">
        <ThemeToggleButton />
      </div>
      <Card className="auth-card" style={{ width: "100%", maxWidth: 560 }}>
        <img src={logoIcon} alt="Logo Badan Gizi Nasional" className="auth-card-logo" />
        <Title level={3} style={{ marginBottom: 4 }}>
          Registrasi SPPG Baru
        </Title>
        <Text type="secondary">Daftarkan unit SPPG dan akun operator. Akun aktif setelah disetujui admin.</Text>

        {error ? <Alert type="error" showIcon message={error} style={{ marginTop: 16 }} /> : null}

        <Steps
          size="small"
          current={step}
          style={{ marginTop: 20, marginBottom: 20 }}
          items={[{ title: "Data SPPG" }, { title: "Akun Operator" }]}
        />

        <Form form={form} layout="vertical" onFinish={onFinish}>
          <div style={{ display: step === 0 ? "block" : "none" }}>
            <Form.Item name="kodeSppg" label="Kode SPPG" rules={[{ required: true, message: "Wajib diisi" }, { pattern: /^[A-Za-z0-9-]{5,20}$/, message: "5-20 karakter alfanumerik (boleh strip)" }]}>
              <Input prefix={<HomeOutlined />} placeholder="contoh: SPPG-BDG-010" />
            </Form.Item>
            <Form.Item name="namaSppg" label="Nama SPPG" rules={[{ required: true, message: "Wajib diisi" }, { min: 3, message: "Minimal 3 karakter" }]}>
              <Input placeholder="contoh: SPPG Bandung Kota 10" />
            </Form.Item>
            <Form.Item name="alamat" label="Alamat" rules={[{ required: true, message: "Wajib diisi" }]}>
              <Input.TextArea rows={2} placeholder="Alamat lengkap SPPG" />
            </Form.Item>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Form.Item name="provinsi" label="Provinsi" rules={[{ required: true, message: "Wajib diisi" }]} style={{ flex: 1, minWidth: 180 }}>
                <Input placeholder="contoh: Jawa Barat" />
              </Form.Item>
              <Form.Item name="kabupatenKota" label="Kabupaten/Kota" rules={[{ required: true, message: "Wajib diisi" }]} style={{ flex: 1, minWidth: 180 }}>
                <Input placeholder="contoh: Kota Bandung" />
              </Form.Item>
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Form.Item name="kecamatan" label="Kecamatan" style={{ flex: 1, minWidth: 180 }}>
                <Input placeholder="(opsional)" />
              </Form.Item>
              <Form.Item name="kapasitasPorsiPerHari" label="Kapasitas Porsi/Hari" rules={[{ required: true, message: "Wajib diisi" }]} style={{ flex: 1, minWidth: 180 }}>
                <InputNumber min={1} style={{ width: "100%" }} placeholder="contoh: 1500" />
              </Form.Item>
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Form.Item name="latitude" label="Latitude" style={{ flex: 1, minWidth: 180 }}>
                <Input prefix={<EnvironmentOutlined />} placeholder="(opsional) -6.9" />
              </Form.Item>
              <Form.Item name="longitude" label="Longitude" style={{ flex: 1, minWidth: 180 }}>
                <Input prefix={<EnvironmentOutlined />} placeholder="(opsional) 107.6" />
              </Form.Item>
            </div>
            <Button type="primary" block onClick={next}>
              Lanjut
            </Button>
          </div>

          <div style={{ display: step === 1 ? "block" : "none" }}>
            <Form.Item name="namaLengkap" label="Nama Lengkap Penanggung Jawab" rules={[{ required: true, message: "Wajib diisi" }]}>
              <Input prefix={<UserOutlined />} placeholder="Nama lengkap" />
            </Form.Item>
            <Form.Item name="username" label="Username" rules={[{ required: true, message: "Wajib diisi" }, { pattern: /^[A-Za-z0-9_]{3,50}$/, message: "3-50 karakter (huruf, angka, underscore)" }]}>
              <Input prefix={<UserOutlined />} placeholder="username operator" autoComplete="username" />
            </Form.Item>
            <Form.Item name="email" label="Email" rules={[{ required: true, message: "Wajib diisi" }, { type: "email", message: "Format email tidak valid" }]}>
              <Input prefix={<MailOutlined />} placeholder="email@domain.com" />
            </Form.Item>
            <Form.Item
              name="password"
              label="Password"
              rules={[
                { required: true, message: "Wajib diisi" },
                { min: 8, message: "Minimal 8 karakter" },
                { pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/, message: "Harus ada huruf besar, kecil, angka, dan simbol" },
              ]}
            >
              <Input.Password prefix={<LockOutlined />} placeholder="Password kuat" autoComplete="new-password" />
            </Form.Item>
            <div style={{ display: "flex", gap: 12 }}>
              <Button block onClick={() => setStep(0)}>
                Kembali
              </Button>
              <Button type="primary" htmlType="submit" block loading={loading}>
                Daftar
              </Button>
            </div>
          </div>
        </Form>

        <div style={{ textAlign: "center", marginTop: 16 }}>
          <Button type="link" onClick={() => navigate("/login")} style={{ color: token.colorTextSecondary }}>
            Sudah punya akun? Masuk
          </Button>
        </div>
      </Card>
    </div>
  );
}
