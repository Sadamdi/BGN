import React, { useEffect, useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Table,
  Tag,
  Input,
  Select,
  Button,
  Space,
  Modal,
  Upload,
  Card,
  App,
  Typography,
  Alert,
} from "antd";
import {
  PlusOutlined,
  UploadOutlined,
  DownloadOutlined,
  ReloadOutlined,
  EyeOutlined,
  EditOutlined,
  StopOutlined,
  InboxOutlined,
} from "@ant-design/icons";

import PageHeader from "../components/layout/PageHeader";
import * as penerimaApi from "../api/penerima.api";
import * as sppgApi from "../api/sppg.api";
import { useAuthStore } from "../store/authStore";

const KATEGORI_COLOR = { PESERTA_DIDIK: "blue", BALITA: "green", IBU_HAMIL: "orange", IBU_MENYUSUI: "purple" };
const KATEGORI_LABEL = { PESERTA_DIDIK: "Peserta Didik", BALITA: "Balita", IBU_HAMIL: "Ibu Hamil", IBU_MENYUSUI: "Ibu Menyusui" };
const STATUS_GIZI_COLOR = { GIZI_BURUK: "red", GIZI_KURANG: "gold", GIZI_BAIK: "green", GIZI_LEBIH: "orange" };

export default function PenerimaListPage() {
  const navigate = useNavigate();
  const { user, hasRole } = useAuthStore();
  const { message, modal } = App.useApp();

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 50, total: 0 });
  const [filter, setFilter] = useState({ search: "", kategori: "", sppgId: "", statusAktif: "" });
  const [searchTimer, setSearchTimer] = useState(null);
  const [sppgOptions, setSppgOptions] = useState([]);
  const [importOpen, setImportOpen] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [uploading, setUploading] = useState(false);

  const showSppgFilter = hasRole("ADMIN", "PENGAWAS_GIZI", "PEJABAT_BGN");

  const fetchData = async (override = {}) => {
    setLoading(true);
    try {
      const r = await penerimaApi.list({
        page: override.page || pagination.current,
        limit: override.limit || pagination.pageSize,
        search: filter.search || undefined,
        kategori: filter.kategori || undefined,
        sppgId: filter.sppgId || undefined,
        statusAktif: filter.statusAktif || undefined,
      });
      setData(r.data || []);
      setPagination((p) => ({ ...p, total: (r.pagination && r.pagination.total) || 0 }));
    } catch (err) {
      message.error((err.response && err.response.data && err.response.data.message) || "Gagal memuat data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData({ page: 1 });
    setPagination((p) => ({ ...p, current: 1 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter.kategori, filter.sppgId, filter.statusAktif]);

  useEffect(() => {
    if (showSppgFilter) {
      sppgApi.list({ limit: 200 }).then((r) => setSppgOptions(r.data || [])).catch(() => {});
    }
  }, [showSppgFilter]);

  const onSearch = (val) => {
    if (searchTimer) clearTimeout(searchTimer);
    const t = setTimeout(() => {
      setFilter((f) => ({ ...f, search: val }));
      fetchData({ page: 1 });
      setPagination((p) => ({ ...p, current: 1 }));
    }, 300);
    setSearchTimer(t);
  };

  const onResetFilter = () => {
    setFilter({ search: "", kategori: "", sppgId: "", statusAktif: "" });
    setTimeout(() => fetchData({ page: 1 }), 0);
  };

  const onNonaktif = (record) => {
    modal.confirm({
      title: "Nonaktifkan penerima",
      content: `Anda yakin menonaktifkan ${record.namaLengkap}? Data tidak akan dihapus permanen.`,
      okText: "Ya, nonaktifkan",
      okButtonProps: { danger: true },
      cancelText: "Batal",
      onOk: async () => {
        try {
          await penerimaApi.nonaktifkan(record.id);
          message.success("Penerima dinonaktifkan");
          fetchData();
        } catch (err) {
          message.error((err.response && err.response.data && err.response.data.message) || "Gagal");
        }
      },
    });
  };

  const onDownloadTemplate = async () => {
    try {
      const blob = await penerimaApi.downloadTemplate();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "Template_Penerima.xlsx";
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      message.error("Gagal mengunduh template");
    }
  };

  const onUpload = async (file) => {
    setUploading(true);
    setImportResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await penerimaApi.importExcel(fd);
      setImportResult(r.data);
      fetchData();
    } catch (err) {
      message.error((err.response && err.response.data && err.response.data.message) || "Gagal import");
    } finally {
      setUploading(false);
    }
    return false;
  };

  const columns = useMemo(() => {
    const cols = [
      { title: "No", render: (_, __, idx) => (pagination.current - 1) * pagination.pageSize + idx + 1, width: 60 },
      { title: "NIK", dataIndex: "nikMasked", render: (v) => <span style={{ fontFamily: "monospace" }}>{v}</span> },
      { title: "Nama Lengkap", dataIndex: "namaLengkap", sorter: true },
      {
        title: "Kategori",
        dataIndex: "kategori",
        render: (v) => <Tag color={KATEGORI_COLOR[v]}>{KATEGORI_LABEL[v] || v}</Tag>,
      },
      { title: "Usia", dataIndex: "usiaLabel" },
      { title: "Satuan Pendidikan", dataIndex: "satuanPendidikan" },
    ];
    if (showSppgFilter) {
      cols.push({ title: "SPPG", render: (r) => (r.sppg ? r.sppg.namaSppg : "-") });
    }
    cols.push({
      title: "Status Gizi",
      dataIndex: "statusGiziTerakhir",
      render: (v) => (v ? <Tag color={STATUS_GIZI_COLOR[v]}>{v}</Tag> : <span style={{ color: "#94a3b8" }}>—</span>),
    });
    cols.push({
      title: "Status",
      dataIndex: "statusAktif",
      render: (v) => (v ? <Tag color="green">Aktif</Tag> : <Tag>Nonaktif</Tag>),
    });
    cols.push({
      title: "Aksi",
      render: (r) => (
        <Space>
          <Button size="small" icon={<EyeOutlined />} onClick={() => navigate(`/penerima/${r.id}`)}>
            Lihat
          </Button>
          <Button size="small" icon={<EditOutlined />} onClick={() => navigate(`/penerima/${r.id}/edit`)}>
            Edit
          </Button>
          {r.statusAktif ? (
            <Button size="small" danger icon={<StopOutlined />} onClick={() => onNonaktif(r)}>
              Nonaktifkan
            </Button>
          ) : null}
        </Space>
      ),
    });
    return cols;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination, showSppgFilter]);

  return (
    <div>
      <PageHeader
        title="Penerima Manfaat"
        subtitle="Kelola data penerima manfaat program MBG"
        actions={
          <Space>
            {hasRole("ADMIN", "OPERATOR_SPPG") ? (
              <>
                <Button icon={<DownloadOutlined />} onClick={onDownloadTemplate}>
                  Template Excel
                </Button>
                <Button icon={<UploadOutlined />} onClick={() => setImportOpen(true)}>
                  Import Excel
                </Button>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate("/penerima/tambah")}>
                  Tambah Penerima
                </Button>
              </>
            ) : null}
          </Space>
        }
      />

      <Card style={{ marginBottom: 16 }}>
        <Space wrap style={{ width: "100%" }}>
          <Input.Search placeholder="Cari NIK / Nama" allowClear onChange={(e) => onSearch(e.target.value)} style={{ width: 260 }} />
          <Select
            placeholder="Kategori"
            allowClear
            style={{ minWidth: 160 }}
            value={filter.kategori || undefined}
            onChange={(v) => setFilter((f) => ({ ...f, kategori: v || "" }))}
            options={Object.entries(KATEGORI_LABEL).map(([k, v]) => ({ value: k, label: v }))}
          />
          {showSppgFilter ? (
            <Select
              placeholder="SPPG"
              allowClear
              showSearch
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
            style={{ minWidth: 140 }}
            value={filter.statusAktif || undefined}
            onChange={(v) => setFilter((f) => ({ ...f, statusAktif: v || "" }))}
            options={[
              { value: "true", label: "Aktif" },
              { value: "false", label: "Nonaktif" },
            ]}
          />
          <Button icon={<ReloadOutlined />} onClick={onResetFilter}>
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
            showTotal: (t) => `Total ${t} data`,
            onChange: (page, pageSize) => {
              setPagination((p) => ({ ...p, current: page, pageSize }));
              fetchData({ page, limit: pageSize });
            },
          }}
          scroll={{ x: 1200 }}
          expandable={{
            expandedRowRender: (record) =>
              record.tanggalPengukuranTerakhir ? (
                <Typography.Text type="secondary">
                  Pengukuran terakhir: {record.tanggalPengukuranTerakhir} — Status: {record.statusGiziTerakhir}
                </Typography.Text>
              ) : (
                <Typography.Text type="secondary">Belum ada pengukuran gizi</Typography.Text>
              ),
          }}
        />
      </Card>

      <Modal title="Import Excel Penerima" open={importOpen} onCancel={() => setImportOpen(false)} footer={null} width={620}>
        <Upload.Dragger
          accept=".xlsx"
          showUploadList={false}
          beforeUpload={onUpload}
          disabled={uploading}
          multiple={false}
        >
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">Klik atau drag file .xlsx ke sini</p>
          <p className="ant-upload-hint">Maksimum 5MB. Gunakan template untuk memastikan format benar.</p>
        </Upload.Dragger>
        <div style={{ marginTop: 12 }}>
          <Button onClick={onDownloadTemplate} icon={<DownloadOutlined />}>
            Unduh Template
          </Button>
        </div>
        {importResult ? (
          <Alert
            type={importResult.gagal === 0 ? "success" : "warning"}
            style={{ marginTop: 12 }}
            message={`Berhasil: ${importResult.berhasil} | Gagal: ${importResult.gagal}`}
            description={
              importResult.errors && importResult.errors.length ? (
                <ul style={{ marginTop: 8 }}>
                  {importResult.errors.map((e, i) => (
                    <li key={i}>
                      Baris {e.baris}: {e.pesan}
                    </li>
                  ))}
                </ul>
              ) : null
            }
            showIcon
          />
        ) : null}
      </Modal>
    </div>
  );
}
