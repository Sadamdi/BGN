import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, Table, Tag, Input, Select, Button, Space, App, Grid } from "antd";
import { PlusOutlined, EyeOutlined, EditOutlined, DownloadOutlined, ReloadOutlined, SyncOutlined } from "@ant-design/icons";

import PageHeader from "../components/layout/PageHeader";
import * as sppgApi from "../api/sppg.api";
import * as publicDataApi from "../api/publicData.api";
import { useAuthStore } from "../store/authStore";

export default function SppgListPage() {
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const filterControlStyle = (desktopWidth) => ({ width: isMobile ? "100%" : desktopWidth, maxWidth: "100%" });
  const navigate = useNavigate();
  const { hasRole } = useAuthStore();
  const { message } = App.useApp();

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 25, total: 0 });
  const [filter, setFilter] = useState({ search: "", provinsi: "", statusAktif: "" });
  const [provList, setProvList] = useState([]);
  const [syncLoading, setSyncLoading] = useState(false);

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

  const onSyncScrape = async () => {
    setSyncLoading(true);
    try {
      const r = await publicDataApi.syncScrapeData();
      if (r && r.data && r.data.skipped) {
        message.warning("Sinkron sedang berjalan. Coba lagi sebentar.");
      } else {
        message.success("Sinkron data berhasil dijalankan.");
      }
      fetchData({ page: 1 });
    } catch (err) {
      message.error((err.response && err.response.data && err.response.data.message) || "Sinkron data gagal");
    } finally {
      setSyncLoading(false);
    }
  };

  const columns = [
    { title: "Kode", dataIndex: "kodeSppg" },
    { title: "Nama SPPG", dataIndex: "namaSppg" },
    { title: "Provinsi", dataIndex: "provinsi" },
    { title: "Kab/Kota", dataIndex: "kabupatenKota" },
    { title: "Kapasitas/hari", dataIndex: "kapasitasPorsiPerHari", align: "right" },
    { title: "Penerima Aktif", dataIndex: "jumlahPenerima", align: "right" },
    { title: "Distribusi Kemarin", dataIndex: "distribusiTerkini", align: "right", render: (v) => (v == null ? <span style={{ color: "#bbb" }}>-</span> : v) },
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
            {hasRole("ADMIN", "PEJABAT_BGN", "PENGAWAS_GIZI") ? (
              <Button icon={<SyncOutlined />} loading={syncLoading} onClick={onSyncScrape}>
                Sinkron Data
              </Button>
            ) : null}
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
        <Space wrap style={{ width: "100%" }}>
          <Input.Search
            placeholder="Cari nama / kode / kab"
            allowClear
            style={filterControlStyle(260)}
            onSearch={(v) => {
              setFilter((f) => ({ ...f, search: v }));
              fetchData({ page: 1 });
            }}
          />
          <Select
            placeholder="Provinsi"
            allowClear
            style={filterControlStyle(220)}
            value={filter.provinsi || undefined}
            onChange={(v) => setFilter((f) => ({ ...f, provinsi: v || "" }))}
            options={provList.map((p) => ({ value: p.provinsi, label: `${p.provinsi} (${p.jumlah})` }))}
          />
          <Select
            placeholder="Status"
            allowClear
            style={filterControlStyle(160)}
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
