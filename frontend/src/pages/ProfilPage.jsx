import React from "react";
import { Card, Descriptions, Form, Input, Button, App, Tag } from "antd";

import PageHeader from "../components/layout/PageHeader";
import { useAuthStore } from "../store/authStore";
import * as authApi from "../api/auth.api";

export default function ProfilPage() {
  const { user } = useAuthStore();
  const { message } = App.useApp();
  const [form] = Form.useForm();

  if (!user) return null;

  const onChangePassword = async (values) => {
    if (values.passwordBaru !== values.konfirmasi) {
      message.error("Konfirmasi password baru tidak sama");
      return;
    }
    try {
      await authApi.ubahPassword({ passwordLama: values.passwordLama, passwordBaru: values.passwordBaru });
      form.resetFields();
      message.success("Password berhasil diubah");
    } catch (err) {
      message.error((err.response && err.response.data && err.response.data.message) || "Gagal");
    }
  };

  return (
    <div>
      <PageHeader title="Profil" />
      <Card style={{ marginBottom: 16 }} title="Informasi Akun">
        <Descriptions column={{ xs: 1, sm: 2 }} bordered size="small">
          <Descriptions.Item label="Nama">{user.namaLengkap}</Descriptions.Item>
          <Descriptions.Item label="Username">{user.username}</Descriptions.Item>
          <Descriptions.Item label="Email">{user.email}</Descriptions.Item>
          <Descriptions.Item label="Peran"><Tag color="blue">{user.peran}</Tag></Descriptions.Item>
          {user.sppgId ? <Descriptions.Item label="SPPG">{user.sppgId}</Descriptions.Item> : null}
          {user.wilayahZona ? <Descriptions.Item label="Wilayah">{user.wilayahZona}</Descriptions.Item> : null}
        </Descriptions>
      </Card>
      <Card title="Ubah Password">
        <Form form={form} layout="vertical" onFinish={onChangePassword} style={{ maxWidth: 420 }}>
          <Form.Item label="Password Lama" name="passwordLama" rules={[{ required: true }]}>
            <Input.Password />
          </Form.Item>
          <Form.Item label="Password Baru" name="passwordBaru" rules={[{ required: true, min: 8 }]}>
            <Input.Password />
          </Form.Item>
          <Form.Item label="Konfirmasi Password Baru" name="konfirmasi" rules={[{ required: true }]}>
            <Input.Password />
          </Form.Item>
          <Button type="primary" htmlType="submit">Simpan</Button>
        </Form>
      </Card>
    </div>
  );
}
