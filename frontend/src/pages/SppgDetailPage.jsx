import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, Descriptions, Spin, Empty, Row, Col, Statistic, Tag, Space, Button } from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import dayjs from "dayjs";

import PageHeader from "../components/layout/PageHeader";
import * as sppgApi from "../api/sppg.api";

export default function SppgDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    sppgApi.detail(id).then((r) => setData(r.data)).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <Spin />;
  if (!data) return <Empty description="SPPG tidak ditemukan" />;

  return (
    <div>
      <PageHeader
        title={data.namaSppg}
        subtitle={`${data.kodeSppg} • ${data.kabupatenKota}, ${data.provinsi}`}
        actions={
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>Kembali</Button>
          </Space>
        }
      />
      <Row gutter={[16, 16]}>
        <Col xs={24} md={6}>
          <Card>
            <Statistic title="Kapasitas/hari" value={data.kapasitasPorsiPerHari} suffix="porsi" />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card>
            <Statistic title="Rata-rata 30 Hari" value={data.statistik.rataRataDistribusi30Hari} suffix="porsi" />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card>
            <Statistic title="Realisasi 30 Hari" value={data.statistik.persentaseRealisasi30Hari} suffix="%" />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card>
            <Statistic title="Penerima Aktif" value={data.statistik.jumlahPenerimaAktif} />
          </Card>
        </Col>
      </Row>

      <Card style={{ marginTop: 16 }} title="Distribusi 7 Hari Terakhir">
        <div style={{ height: 240 }}>
          <ResponsiveContainer>
            <AreaChart data={data.statistik.distribusi7HariTerakhir.map((d) => ({ ...d, label: dayjs(d.tanggal).format("DD/MM") }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" />
              <YAxis />
              <Tooltip />
              <Area dataKey="totalPorsi" stroke="#1B3A6B" fill="#1B3A6B" fillOpacity={0.2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card style={{ marginTop: 16 }} title="Detail">
        <Descriptions column={{ xs: 1, sm: 2, lg: 3 }} bordered size="small">
          <Descriptions.Item label="Alamat" span={3}>{data.alamat}</Descriptions.Item>
          <Descriptions.Item label="Mitra">{data.mitraPengelola || "-"}</Descriptions.Item>
          <Descriptions.Item label="Penanggung Jawab">{data.kontakPenanggungJawab || "-"}</Descriptions.Item>
          <Descriptions.Item label="Telepon">{data.telepon || "-"}</Descriptions.Item>
          <Descriptions.Item label="Latitude">{data.latitude || "-"}</Descriptions.Item>
          <Descriptions.Item label="Longitude">{data.longitude || "-"}</Descriptions.Item>
          <Descriptions.Item label="Status">{data.statusAktif ? <Tag color="green">Aktif</Tag> : <Tag>Nonaktif</Tag>}</Descriptions.Item>
        </Descriptions>
      </Card>
    </div>
  );
}
