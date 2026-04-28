import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  Form,
  DatePicker,
  InputNumber,
  Row,
  Col,
  Button,
  Space,
  Steps,
  Alert,
  Progress,
  Typography,
  Upload,
  Select,
  Statistic,
  App,
} from "antd";
import { UploadOutlined } from "@ant-design/icons";
import dayjs from "dayjs";

import PageHeader from "../components/layout/PageHeader";
import * as distApi from "../api/distribusi.api";
import * as sppgApi from "../api/sppg.api";
import { useAuthStore } from "../store/authStore";

export default function DistribusiFormPage() {
  const navigate = useNavigate();
  const { user, hasRole } = useAuthStore();
  const { message } = App.useApp();

  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);
  const [sppg, setSppg] = useState(null);
  const [sppgOptions, setSppgOptions] = useState([]);
  const [uploadFile, setUploadFile] = useState(null);

  useEffect(() => {
    if (hasRole("ADMIN")) {
      sppgApi.list({ limit: 200 }).then((r) => setSppgOptions(r.data || [])).catch(() => {});
    } else if (user.sppgId) {
      sppgApi.detail(user.sppgId).then((r) => setSppg(r.data)).catch(() => {});
    }
  }, [hasRole, user.sppgId]);

  const onSelectSppg = async (id) => {
    try {
      const r = await sppgApi.detail(id);
      setSppg(r.data);
    } catch (_) {}
  };

  const pd = Form.useWatch("porsiPesertaDidik", form) || 0;
  const ba = Form.useWatch("porsiBalita", form) || 0;
  const ih = Form.useWatch("porsiIbuHamil", form) || 0;
  const im = Form.useWatch("porsiIbuMenyusui", form) || 0;
  const totalCalc = Number(pd) + Number(ba) + Number(ih) + Number(im);

  const persen = sppg ? Math.min(120, (totalCalc / Math.max(1, sppg.kapasitasPorsiPerHari)) * 100) : 0;
  const overWarn = sppg && totalCalc > sppg.kapasitasPorsiPerHari * 1.2;

  const onSubmit = async () => {
    try {
      const v = await form.validateFields();
      setLoading(true);
      const payload = {
        sppgId: v.sppgId || (sppg && sppg.id),
        tanggalDistribusi: v.tanggalDistribusi.toISOString(),
        porsiPesertaDidik: Number(v.porsiPesertaDidik) || 0,
        porsiBalita: Number(v.porsiBalita) || 0,
        porsiIbuHamil: Number(v.porsiIbuHamil) || 0,
        porsiIbuMenyusui: Number(v.porsiIbuMenyusui) || 0,
        catatan: v.catatan || "",
      };
      const r = await distApi.create(payload);
      const id = r.data && r.data.id;
      if (id && uploadFile) {
        const fd = new FormData();
        fd.append("foto", uploadFile);
        try {
          await distApi.uploadBukti(id, fd);
        } catch (_) {
          message.warning("Distribusi tersimpan tetapi unggah foto gagal");
        }
      }
      message.success("Distribusi tersimpan");
      navigate("/distribusi");
    } catch (err) {
      const msg = err.response && err.response.data && err.response.data.message;
      if (msg) message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <PageHeader title="Input Distribusi MBG" breadcrumb={["Distribusi", "Input"]} />

      <Steps
        current={step}
        items={[
          { title: "Pilih Tanggal" },
          { title: "Input Porsi" },
          { title: "Review & Simpan" },
        ]}
        style={{ marginBottom: 16 }}
      />

      <Card>
        <Form form={form} layout="vertical">
          {step === 0 ? (
            <>
              {hasRole("ADMIN") ? (
                <Form.Item label="SPPG" name="sppgId" rules={[{ required: true }]}>
                  <Select
                    showSearch
                    options={sppgOptions.map((s) => ({ value: s.id, label: s.namaSppg }))}
                    onChange={onSelectSppg}
                    filterOption={(input, option) => (option.label || "").toLowerCase().includes(input.toLowerCase())}
                  />
                </Form.Item>
              ) : (
                <Alert
                  message={sppg ? `SPPG: ${sppg.namaSppg}` : "Memuat data SPPG..."}
                  description={sppg ? `Kapasitas: ${sppg.kapasitasPorsiPerHari} porsi/hari` : null}
                  type="info"
                  style={{ marginBottom: 16 }}
                />
              )}

              <Form.Item label="Tanggal Distribusi" name="tanggalDistribusi" initialValue={dayjs().startOf("day")} rules={[{ required: true }]}>
                <DatePicker
                  format="DD/MM/YYYY"
                  style={{ width: 220 }}
                  disabledDate={(d) => d && d > dayjs().endOf("day")}
                />
              </Form.Item>

              <Button type="primary" onClick={() => setStep(1)}>
                Lanjut
              </Button>
            </>
          ) : null}

          {step === 1 ? (
            <>
              <Row gutter={16}>
                <Col xs={24} md={6}>
                  <Form.Item label="Peserta Didik" name="porsiPesertaDidik" initialValue={0}>
                    <InputNumber min={0} style={{ width: "100%" }} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={6}>
                  <Form.Item label="Balita" name="porsiBalita" initialValue={0}>
                    <InputNumber min={0} style={{ width: "100%" }} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={6}>
                  <Form.Item label="Ibu Hamil" name="porsiIbuHamil" initialValue={0}>
                    <InputNumber min={0} style={{ width: "100%" }} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={6}>
                  <Form.Item label="Ibu Menyusui" name="porsiIbuMenyusui" initialValue={0}>
                    <InputNumber min={0} style={{ width: "100%" }} />
                  </Form.Item>
                </Col>
              </Row>

              <Statistic title="Total Porsi" value={totalCalc} />
              {sppg ? (
                <div style={{ margin: "8px 0 16px" }}>
                  <Progress
                    percent={Math.min(100, persen)}
                    status={overWarn ? "exception" : persen < 80 ? "active" : "success"}
                    format={() => `${totalCalc} / ${sppg.kapasitasPorsiPerHari}`}
                  />
                </div>
              ) : null}
              {overWarn ? (
                <Alert type="error" message="Total porsi melebihi 120% kapasitas SPPG" showIcon style={{ marginBottom: 12 }} />
              ) : null}

              <Form.Item label="Catatan" name="catatan">
                <input className="ant-input" placeholder="(opsional)" />
              </Form.Item>
              <Form.Item label="Foto Bukti">
                <Upload
                  accept="image/jpeg,image/png"
                  maxCount={1}
                  beforeUpload={(file) => {
                    setUploadFile(file);
                    return false;
                  }}
                  onRemove={() => setUploadFile(null)}
                >
                  <Button icon={<UploadOutlined />}>Pilih Foto</Button>
                </Upload>
              </Form.Item>

              <Space>
                <Button onClick={() => setStep(0)}>Kembali</Button>
                <Button type="primary" disabled={overWarn} onClick={() => setStep(2)}>
                  Lanjut
                </Button>
              </Space>
            </>
          ) : null}

          {step === 2 ? (
            <>
              <Typography.Paragraph>
                Pastikan data sudah benar. Setelah simpan, status awal adalah <b>DRAFT</b> dan menunggu konfirmasi Pengawas Gizi.
              </Typography.Paragraph>
              <Statistic title="Realisasi" value={persen.toFixed(1) + "%"} />
              <Space style={{ marginTop: 16 }}>
                <Button onClick={() => setStep(1)}>Kembali</Button>
                <Button type="primary" loading={loading} onClick={onSubmit}>
                  Simpan
                </Button>
              </Space>
            </>
          ) : null}
        </Form>
      </Card>
    </div>
  );
}
