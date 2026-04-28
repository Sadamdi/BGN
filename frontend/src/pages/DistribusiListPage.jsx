import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, Table, Tag, Button, Space, App, DatePicker, Select } from "antd";
import { PlusOutlined, CheckCircleOutlined, AuditOutlined, FileImageOutlined } from "@ant-design/icons";
import dayjs from "dayjs";

import PageHeader from "../components/layout/PageHeader";
import * as distApi from "../api/distribusi.api";
import * as sppgApi from "../api/sppg.api";
import { useAuthStore } from "../store/authStore";

const STATUS_COLOR = { DRAFT: "default", TERKONFIRMASI: "blue", TERVALIDASI: "green" };

export default function DistribusiListPage() {
  const navigate = useNavigate();
  const { hasRole } = useAuthStore();
  const { message } = App.useApp();

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 25, total: 0 });
  const [filter, setFilter] = useState({ sppgId: "", status: "", range: null });
  const [sppgOptions, setSppgOptions] = useState([]);

  const fetchData = async (override = {}) => {
    setLoading(true);
    try {
      const params = {
        page: override.page || pagination.current,
        limit: override.limit || pagination.pageSize,
        sppgId: filter.sppgId || undefined,
        status: filter.status || undefined,
      };
      if (filter.range && filter.range[0]) params.tanggalMulai = filter.range[0].format("YYYY-MM-DD");
      if (filter.range && filter.range[1]) params.tanggalAkhir = filter.range[1].format("YYYY-MM-DD");
      const r = await distApi.list(params);
      setData(r.data || []);
      setPagination((p) => ({ ...p, total: (r.pagination && r.pagination.total) || 0 }));
    } catch (err) {
      message.error("Gagal memuat distribusi");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    if (hasRole("ADMIN", "PENGAWAS_GIZI", "PEJABAT_BGN")) {
      sppgApi.list({ limit: 200 }).then((r) => setSppgOptions(r.data || [])).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchData({ page: 1 });
    setPagination((p) => ({ ...p, current: 1 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter.sppgId, filter.status, filter.range]);

  const onAksi = async (record, jenis) => {
    try {
      if (jenis === "konfirmasi") await distApi.konfirmasi(record.id);
      if (jenis === "validasi") await distApi.validasi(record.id);
      message.success("Status diperbarui");
      fetchData();
    } catch (err) {
      message.error((err.response && err.response.data && err.response.data.message) || "Gagal");
    }
  };

  const columns = [
    { title: "Tanggal", dataIndex: "tanggalDistribusi", render: (v) => dayjs(v).format("DD MMM YYYY") },
    { title: "SPPG", render: (r) => r.sppg && r.sppg.namaSppg },
    { title: "PD", dataIndex: "porsiPesertaDidik", align: "right" },
    { title: "Balita", dataIndex: "porsiBalita", align: "right" },
    { title: "Hamil", dataIndex: "porsiIbuHamil", align: "right" },
    { title: "Menyusui", dataIndex: "porsiIbuMenyusui", align: "right" },
    { title: "Total", dataIndex: "totalPorsi", align: "right" },
    { title: "Realisasi %", dataIndex: "realisasiPersen", align: "right", render: (v) => (v ? v + "%" : "-") },
    { title: "Status", dataIndex: "status", render: (v) => <Tag color={STATUS_COLOR[v]}>{v}</Tag> },
    {
      title: "Bukti",
      dataIndex: "fotoBuktiUrl",
      render: (url) => url ? <a href={(import.meta.env.VITE_SOCKET_URL || "http://localhost:3000") + url} target="_blank" rel="noreferrer"><FileImageOutlined /></a> : "-",
    },
    {
      title: "Aksi",
      render: (r) => (
        <Space>
          {hasRole("PENGAWAS_GIZI", "ADMIN") && r.status === "DRAFT" ? (
            <Button size="small" icon={<CheckCircleOutlined />} onClick={() => onAksi(r, "konfirmasi")}>
              Konfirmasi
            </Button>
          ) : null}
          {hasRole("PENGAWAS_GIZI", "ADMIN") && r.status === "TERKONFIRMASI" ? (
            <Button size="small" type="primary" icon={<AuditOutlined />} onClick={() => onAksi(r, "validasi")}>
              Validasi
            </Button>
          ) : null}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Distribusi MBG"
        actions={
          hasRole("OPERATOR_SPPG", "ASISTEN_LAPANGAN", "ADMIN") ? (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate("/distribusi/input")}>
              Input Distribusi
            </Button>
          ) : null
        }
      />
      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          {hasRole("ADMIN", "PENGAWAS_GIZI", "PEJABAT_BGN") ? (
            <Select
              showSearch
              placeholder="SPPG"
              allowClear
              style={{ minWidth: 240 }}
              value={filter.sppgId || undefined}
              onChange={(v) => setFilter((f) => ({ ...f, sppgId: v || "" }))}
              options={sppgOptions.map((s) => ({ value: s.id, label: s.namaSppg }))}
              filterOption={(input, option) => (option.label || "").toLowerCase().includes(input.toLowerCase())}
            />
          ) : null}
          <Select
            placeholder="Status"
            allowClear
            style={{ minWidth: 160 }}
            value={filter.status || undefined}
            onChange={(v) => setFilter((f) => ({ ...f, status: v || "" }))}
            options={["DRAFT", "TERKONFIRMASI", "TERVALIDASI"].map((v) => ({ value: v, label: v }))}
          />
          <DatePicker.RangePicker
            value={filter.range}
            onChange={(v) => setFilter((f) => ({ ...f, range: v }))}
          />
        </Space>
      </Card>
      <Card>
        <Table
          rowKey="id"
          loading={loading}
          dataSource={data}
          columns={columns}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            showTotal: (t) => `Total ${t} laporan`,
            onChange: (page, pageSize) => {
              setPagination((p) => ({ ...p, current: page, pageSize }));
              fetchData({ page, limit: pageSize });
            },
          }}
          scroll={{ x: 1300 }}
        />
      </Card>
    </div>
  );
}
