import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  Form,
  DatePicker,
  InputNumber,
  AutoComplete,
  Steps,
  Space,
  Button,
  Row,
  Col,
  Tag,
  Alert,
  Statistic,
  Descriptions,
  App,
} from "antd";
import dayjs from "dayjs";

import PageHeader from "../components/layout/PageHeader";
import * as penerimaApi from "../api/penerima.api";
import * as giziApi from "../api/gizi.api";

const STATUS_COLOR = { GIZI_BURUK: "red", GIZI_KURANG: "gold", GIZI_BAIK: "green", GIZI_LEBIH: "orange" };

export default function GiziFormPage() {
  const navigate = useNavigate();
  const { message } = App.useApp();

  const [form] = Form.useForm();
  const [step, setStep] = useState(0);
  const [search, setSearch] = useState("");
  const [options, setOptions] = useState([]);
  const [penerima, setPenerima] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [hasil, setHasil] = useState(null);

  const onSearch = async (val) => {
    setSearch(val);
    if ((val || "").length < 2) return;
    try {
      const r = await penerimaApi.list({ search: val, limit: 10 });
      setOptions((r.data || []).map((p) => ({
        value: p.id,
        label: `${p.namaLengkap} • ${p.nikMasked} • ${p.kategori}`,
      })));
    } catch (_) {}
  };

  const onSelect = async (value, option) => {
    try {
      const r = await penerimaApi.detail(value);
      setPenerima(r.data);
      setStep(1);
    } catch (_) {
      message.error("Gagal memuat penerima");
    }
  };

  const onSubmit = async () => {
    try {
      const v = await form.validateFields();
      setSubmitting(true);
      const payload = {
        penerimaId: penerima.id,
        tanggalPengukuran: v.tanggalPengukuran.toISOString(),
        beratBadanKg: v.beratBadanKg,
        tinggiBadanCm: v.tinggiBadanCm,
        lilaCm: v.lilaCm || null,
      };
      const r = await giziApi.create(payload);
      setHasil(r.data);
      setStep(2);
    } catch (err) {
      const msg = err.response && err.response.data && err.response.data.message;
      if (msg) message.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <PageHeader title="Input Pengukuran Gizi" breadcrumb={["Status Gizi", "Input"]} />
      <Steps current={step} items={[{ title: "Cari Penerima" }, { title: "Input Pengukuran" }, { title: "Hasil" }]} style={{ marginBottom: 16 }} />

      {step === 0 ? (
        <Card>
          <AutoComplete
            value={search}
            options={options}
            onSearch={onSearch}
            onSelect={onSelect}
            style={{ width: "100%" }}
            placeholder="Cari NIK atau nama penerima..."
          />
        </Card>
      ) : null}

      {step === 1 && penerima ? (
        <>
          <Card style={{ marginBottom: 16 }}>
            <Descriptions title={penerima.namaLengkap} column={{ xs: 1, sm: 2, lg: 3 }} bordered size="small">
              <Descriptions.Item label="NIK">{penerima.nikMasked}</Descriptions.Item>
              <Descriptions.Item label="Tgl Lahir">{dayjs(penerima.tanggalLahir).format("DD MMM YYYY")}</Descriptions.Item>
              <Descriptions.Item label="Usia">{penerima.usia.label}</Descriptions.Item>
              <Descriptions.Item label="Kategori"><Tag color="blue">{penerima.kategori}</Tag></Descriptions.Item>
              <Descriptions.Item label="SPPG">{penerima.sppg && penerima.sppg.namaSppg}</Descriptions.Item>
              <Descriptions.Item label="Pengukuran terakhir">
                {penerima.pemantauanGizi && penerima.pemantauanGizi[0]
                  ? dayjs(penerima.pemantauanGizi[0].tanggalPengukuran).format("DD MMM YYYY") +
                    " — " + penerima.pemantauanGizi[0].statusGizi
                  : "Belum ada"}
              </Descriptions.Item>
            </Descriptions>
          </Card>
          <Card>
            <Form form={form} layout="vertical" initialValues={{ tanggalPengukuran: dayjs() }}>
              <Row gutter={16}>
                <Col xs={24} md={6}>
                  <Form.Item label="Tanggal Pengukuran" name="tanggalPengukuran" rules={[{ required: true }]}>
                    <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" disabledDate={(d) => d && d > dayjs().endOf("day")} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={6}>
                  <Form.Item label="Berat Badan (kg)" name="beratBadanKg" rules={[{ required: true, type: "number", min: 0.1, max: 300 }]}>
                    <InputNumber min={0.1} max={300} step={0.1} style={{ width: "100%" }} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={6}>
                  <Form.Item label="Tinggi/Panjang (cm)" name="tinggiBadanCm" rules={[{ required: true, type: "number", min: 30, max: 250 }]}>
                    <InputNumber min={30} max={250} step={0.1} style={{ width: "100%" }} />
                  </Form.Item>
                </Col>
                {penerima.kategori === "IBU_HAMIL" ? (
                  <Col xs={24} md={6}>
                    <Form.Item label="LILA (cm)" name="lilaCm">
                      <InputNumber min={5} max={50} step={0.1} style={{ width: "100%" }} />
                    </Form.Item>
                  </Col>
                ) : null}
              </Row>
              <Space>
                <Button onClick={() => setStep(0)}>Kembali</Button>
                <Button type="primary" loading={submitting} onClick={onSubmit}>
                  Hitung & Simpan
                </Button>
              </Space>
            </Form>
          </Card>
        </>
      ) : null}

      {step === 2 && hasil ? (
        <Card>
          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Statistic title="Z-Score BB/U" value={hasil.zscore.zscoreBbU !== null ? hasil.zscore.zscoreBbU : "-"} />
            </Col>
            <Col xs={24} md={8}>
              <Statistic title="Z-Score TB/U" value={hasil.zscore.zscoreTbU !== null ? hasil.zscore.zscoreTbU : "-"} />
            </Col>
            <Col xs={24} md={8}>
              <Statistic title="Z-Score BB/TB" value={hasil.zscore.zscoreBbTb !== null ? hasil.zscore.zscoreBbTb : "-"} />
            </Col>
          </Row>
          <div style={{ marginTop: 16 }}>
            <Tag color={STATUS_COLOR[hasil.klasifikasi.statusGizi]} style={{ fontSize: 18, padding: "6px 14px" }}>
              {hasil.klasifikasi.statusGizi.replace("_", " ")}
            </Tag>
            {hasil.klasifikasi.stunting ? (
              <Tag color="red" style={{ fontSize: 18, padding: "6px 14px", marginLeft: 8 }}>
                STUNTING TERDETEKSI
              </Tag>
            ) : null}
          </div>
          {hasil.klasifikasi.statusGizi === "GIZI_BURUK" || hasil.klasifikasi.stunting ? (
            <Alert
              type="error"
              showIcon
              style={{ marginTop: 16 }}
              message="Tindak lanjut diperlukan"
              description="Pengawas Gizi telah dinotifikasi. Pastikan rujukan/intervensi gizi dilakukan."
            />
          ) : null}
          <Space style={{ marginTop: 16 }}>
            <Button onClick={() => navigate("/gizi")}>Selesai</Button>
            <Button type="primary" onClick={() => navigate(`/penerima/${penerima.id}`)}>
              Lihat Riwayat
            </Button>
          </Space>
        </Card>
      ) : null}
    </div>
  );
}
