import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, Row, Col, Statistic, Button, Space, Spin, App, DatePicker } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import dayjs from "dayjs";

import PageHeader from "../components/layout/PageHeader";
import * as giziApi from "../api/gizi.api";
import { useAuthStore } from "../store/authStore";

export default function GiziListPage() {
  const navigate = useNavigate();
  const { hasRole } = useAuthStore();
  const { message } = App.useApp();

  const [stat, setStat] = useState(null);
  const [loading, setLoading] = useState(true);
  const [periodeAwal, setPeriodeAwal] = useState(dayjs().subtract(6, "month"));
  const [periodeAkhir, setPeriodeAkhir] = useState(dayjs());

  const fetchStat = async () => {
    setLoading(true);
    try {
      const r = await giziApi.prevalensi({
        periodeAwal: periodeAwal.format("YYYY-MM-DD"),
        periodeAkhir: periodeAkhir.format("YYYY-MM-DD"),
      });
      setStat(r.data);
    } catch (err) {
      message.error("Gagal memuat prevalensi");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <PageHeader
        title="Status Gizi"
        actions={
          hasRole("PENGAWAS_GIZI", "OPERATOR_SPPG", "ADMIN") ? (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate("/gizi/input")}>
              Input Pengukuran
            </Button>
          ) : null
        }
      />
      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <DatePicker.RangePicker
            value={[periodeAwal, periodeAkhir]}
            onChange={(v) => {
              if (v && v[0] && v[1]) {
                setPeriodeAwal(v[0]);
                setPeriodeAkhir(v[1]);
              }
            }}
          />
          <Button onClick={fetchStat}>Terapkan</Button>
        </Space>
      </Card>
      {loading || !stat ? (
        <Spin />
      ) : (
        <Row gutter={[16, 16]}>
          <Col xs={24} md={6}>
            <Card>
              <Statistic title="Total Diukur" value={stat.totalDiukur} />
            </Card>
          </Col>
          <Col xs={24} md={6}>
            <Card>
              <Statistic title="Prevalensi Stunting" value={stat.prevalensiStunting} suffix="%" valueStyle={{ color: "#ff4d4f" }} />
            </Card>
          </Col>
          <Col xs={24} md={6}>
            <Card>
              <Statistic title="Prevalensi Wasting" value={stat.prevalensiWasting} suffix="%" valueStyle={{ color: "#fa8c16" }} />
            </Card>
          </Col>
          <Col xs={24} md={6}>
            <Card>
              <Statistic title="Underweight" value={stat.prevalensiUnderweight} suffix="%" valueStyle={{ color: "#faad14" }} />
            </Card>
          </Col>
          <Col xs={24} md={6}>
            <Card>
              <Statistic title="Gizi Baik" value={stat.prevalensiGiziBaik} suffix="%" valueStyle={{ color: "#52c41a" }} />
            </Card>
          </Col>
        </Row>
      )}
    </div>
  );
}
