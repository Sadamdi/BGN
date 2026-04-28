import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, Form, Input, InputNumber, Row, Col, Button, Space, App } from "antd";

import PageHeader from "../components/layout/PageHeader";
import * as sppgApi from "../api/sppg.api";

export default function SppgFormPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const { message } = App.useApp();

  useEffect(() => {
    if (!isEdit) return;
    setLoading(true);
    sppgApi
      .detail(id)
      .then((r) => form.setFieldsValue(r.data))
      .finally(() => setLoading(false));
  }, [id, isEdit, form]);

  const onFinish = async (values) => {
    setLoading(true);
    try {
      if (isEdit) {
        await sppgApi.update(id, values);
        message.success("SPPG diperbarui");
      } else {
        await sppgApi.create(values);
        message.success("SPPG ditambahkan");
      }
      navigate("/sppg");
    } catch (err) {
      const fields = err.response && err.response.data && err.response.data.fields;
      if (fields) {
        Object.entries(fields).forEach(([k, v]) => message.error(`${k}: ${v}`));
      } else {
        message.error((err.response && err.response.data && err.response.data.message) || "Gagal menyimpan");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <PageHeader title={isEdit ? "Edit SPPG" : "Tambah SPPG"} breadcrumb={["SPPG", isEdit ? "Edit" : "Tambah"]} />
      <Card>
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item label="Kode SPPG" name="kodeSppg" rules={[{ required: true }]}>
                <Input placeholder="SPPG-XXX-001" />
              </Form.Item>
            </Col>
            <Col xs={24} md={16}>
              <Form.Item label="Nama SPPG" name="namaSppg" rules={[{ required: true, min: 3 }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24}>
              <Form.Item label="Alamat" name="alamat" rules={[{ required: true }]}>
                <Input.TextArea rows={2} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item label="Provinsi" name="provinsi" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item label="Kabupaten/Kota" name="kabupatenKota" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item label="Kecamatan" name="kecamatan">
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item label="Latitude" name="latitude">
                <InputNumber min={-11} max={6} step={0.000001} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item label="Longitude" name="longitude">
                <InputNumber min={95} max={141} step={0.000001} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item label="Kapasitas Porsi / Hari" name="kapasitasPorsiPerHari" rules={[{ required: true }]}>
                <InputNumber min={1} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label="Mitra Pengelola" name="mitraPengelola">
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Form.Item label="Kontak PJ" name="kontakPenanggungJawab">
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Form.Item label="Telepon" name="telepon">
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Space>
            <Button type="primary" htmlType="submit" loading={loading}>
              Simpan
            </Button>
            <Button onClick={() => navigate("/sppg")}>Batal</Button>
          </Space>
        </Form>
      </Card>
    </div>
  );
}
