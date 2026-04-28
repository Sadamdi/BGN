import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, Table, Tag, Input, Select, Button, Space, App } from "antd";
import { PlusOutlined, EyeOutlined, EditOutlined, DownloadOutlined, ReloadOutlined } from "@ant-design/icons";

import PageHeader from "../components/layout/PageHeader";
import * as sppgApi from "../api/sppg.api";
import { useAuthStore } from "../store/authStore";

export default function SppgListPage() {
  const navigate = useNavigate();
  const { hasRole } = useAuthStore();
  const { message } = App.useApp();

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 25, total: 0 });
  const [filter, setFilter] = useState({ search: "", provinsi: "", statusAktif: "" });
  const [provList, setProvList] = useState([]);

  const fetchData = async (override = {}) => {
    setLoading(true);
    try {
      const r = await sppgApi.list({
        page: override.page || pagination.current,
        limit: override.limit || pagination.pageSize,
        search: filter.search || undefined,
        provinsi: filter.provinsi || undefined,
        statusAktif: filter.statusAktif || undefined,
      });
      setData(r.data || []);
      setPagination((p) => ({ ...p, total: (r.pagination && r.pagination.total) || 0 }));
    } catch (err) {
      message.error("Gagal memuat SPPG");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    sppgApi.provinsiList().then((r) => setProvList(r.data || [])).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchData({ page: 1 });
    setPagination((p) => ({ ...p, current: 1 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter.provinsi, filter.statusAktif]);

  const onToggle = async (record) => {
    try {
      const r = await sppgApi.toggleStatus(record.id);
      message.success("Status diperbarui");
      if (r.data && r.data.warning) message.warning(r.data.warning);
      fetchData();
    } catch (err) {
      message.error("Gagal mengubah status");
    }
  };

  const onDownloadGeo = async () => {
    try {
      const r = await sppgApi.exportGeoJSON();
      const blob = new Blob([JSON.stringify(r, null, 2)], { type: "application/geo+json" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "SPPG_SIPGN.geojson";
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (_) {
      message.error("Gagal export GeoJSON");
    }
  };

  const columns = [
    { title: "Kode", dataIndex: "kodeSppg" },
    { title: "Nama SPPG", dataIndex: "namaSppg" },
    { title: "Provinsi", dataIndex: "provinsi" },
    { title: "Kab/Kota", dataIndex: "kabupatenKota" },
    { title: "Kapasitas/hari", dataIndex: "kapasitasPorsiPerHari", align: "right" },
    { title: "Penerima Aktif", dataIndex: "jumlahPenerima", align: "right" },
    { title: "Distribusi Kemarin", dataIndex: "distribusiTerkini", align: "right" },
    {
      title: "Status",
      dataIndex: "statusAktif",
      render: (v) => (v ? <Tag color="green">Aktif</Tag> : <Tag>Nonaktif</Tag>),
    },
    {
      title: "Aksi",
      render: (r) => (
        <Space>
          <Button size="small" icon={<EyeOutlined />} onClick={() => navigate(`/sppg/${r.id}`)}>
            Detail
          </Button>
          {hasRole("ADMIN") ? (
            <>
              <Button size="small" icon={<EditOutlined />} onClick={() => navigate(`/sppg/${r.id}/edit`)}>
                Edit
              </Button>
              <Button size="small" onClick={() => onToggle(r)}>
                {r.statusAktif ? "Nonaktifkan" : "Aktifkan"}
              </Button>
            </>
          ) : null}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="SPPG (Satuan Pelayanan Pemenuhan Gizi)"
        actions={
          <Space>
            <Button icon={<DownloadOutlined />} onClick={onDownloadGeo}>
              Export GeoJSON
            </Button>
            {hasRole("ADMIN") ? (
              <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate("/sppg/tambah")}>
                Tambah SPPG
              </Button>
            ) : null}
          </Space>
        }
      />
      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <Input.Search
            placeholder="Cari nama / kode / kab"
            allowClear
            style={{ width: 260 }}
            onSearch={(v) => {
              setFilter((f) => ({ ...f, search: v }));
              fetchData({ page: 1 });
            }}
          />
          <Select
            placeholder="Provinsi"
            allowClear
            style={{ minWidth: 200 }}
            value={filter.provinsi || undefined}
            onChange={(v) => setFilter((f) => ({ ...f, provinsi: v || "" }))}
            options={provList.map((p) => ({ value: p.provinsi, label: `${p.provinsi} (${p.jumlah})` }))}
          />
          <Select
            placeholder="Status"
            allowClear
            style={{ minWidth: 140 }}
            value={filter.statusAktif || undefined}
            onChange={(v) => setFilter((f) => ({ ...f, statusAktif: v || "" }))}
            options={[
              { value: "true", label: "Aktif" },
              { value: "false", label: "Nonaktif" },
            ]}
          />
          <Button icon={<ReloadOutlined />} onClick={() => setFilter({ search: "", provinsi: "", statusAktif: "" })}>
            Reset
          </Button>
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
            showTotal: (t) => `Total ${t} SPPG`,
            onChange: (page, pageSize) => {
              setPagination((p) => ({ ...p, current: page, pageSize }));
              fetchData({ page, limit: pageSize });
            },
          }}
          scroll={{ x: 1100 }}
        />
      </Card>
    </div>
  );
}
