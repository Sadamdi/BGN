import React, { useEffect, useState } from "react";
import {
  Card,
  Table,
  Tag,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Select,
  Progress,
  App,
} from "antd";
import { PlusOutlined, EditOutlined, KeyOutlined, ReloadOutlined } from "@ant-design/icons";
import dayjs from "dayjs";

import PageHeader from "../components/layout/PageHeader";
import * as penggunaApi from "../api/pengguna.api";
import * as sppgApi from "../api/sppg.api";

const PERAN_OPTIONS = [
  { value: "ADMIN", label: "Administrator" },
  { value: "PEJABAT_BGN", label: "Pejabat BGN" },
  { value: "PENGAWAS_GIZI", label: "Pengawas Gizi" },
  { value: "OPERATOR_SPPG", label: "Operator SPPG" },
  { value: "ASISTEN_LAPANGAN", label: "Asisten Lapangan" },
];

function strength(p) {
  if (!p) return 0;
  let s = 0;
  if (p.length >= 8) s += 25;
  if (/[A-Z]/.test(p)) s += 20;
  if (/[a-z]/.test(p)) s += 20;
  if (/[0-9]/.test(p)) s += 20;
  if (/[^A-Za-z0-9]/.test(p)) s += 15;
  return Math.min(100, s);
}

export default function PenggunaPage() {
  const { message, modal } = App.useApp();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 25, total: 0 });
  const [filter, setFilter] = useState({ peran: "", statusAktif: "", search: "" });
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  const [sppgOptions, setSppgOptions] = useState([]);
  const [pwd, setPwd] = useState("");

  const fetchData = async (override = {}) => {
    setLoading(true);
    try {
      const r = await penggunaApi.list({
        page: override.page || pagination.current,
        limit: override.limit || pagination.pageSize,
        peran: filter.peran || undefined,
        statusAktif: filter.statusAktif || undefined,
        search: filter.search || undefined,
      });
      setData(r.data || []);
      setPagination((p) => ({ ...p, total: (r.pagination && r.pagination.total) || 0 }));
    } catch (err) {
      message.error("Gagal memuat pengguna");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    sppgApi.list({ limit: 200 }).then((r) => setSppgOptions(r.data || [])).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter.peran, filter.statusAktif]);

  const onSubmit = async (values) => {
    try {
      if (editing) {
        await penggunaApi.update(editing.id, values);
        message.success("Pengguna diperbarui");
      } else {
        await penggunaApi.create(values);
        message.success("Pengguna ditambahkan");
      }
      setOpen(false);
      setEditing(null);
      form.resetFields();
      fetchData();
    } catch (err) {
      const fields = err.response && err.response.data && err.response.data.fields;
      if (fields) Object.entries(fields).forEach(([k, v]) => message.error(`${k}: ${v}`));
      else message.error((err.response && err.response.data && err.response.data.message) || "Gagal");
    }
  };

  const onResetPwd = (record) => {
    modal.confirm({
      title: "Reset password",
      content: `Password ${record.namaLengkap} akan direset dan dikirim via email ke ${record.email}.`,
      okText: "Reset",
      onOk: async () => {
        try {
          await penggunaApi.resetPassword(record.id);
          message.success("Password direset. Cek email pengguna.");
        } catch (_) {
          message.error("Gagal reset password");
        }
      },
    });
  };

  const onToggleStatus = async (record) => {
    try {
      await penggunaApi.toggleStatus(record.id);
      fetchData();
    } catch (_) {
      message.error("Gagal toggle status");
    }
  };

  const peranWatch = Form.useWatch("peran", form);

  const columns = [
    { title: "Nama", dataIndex: "namaLengkap" },
    { title: "Username", dataIndex: "username" },
    { title: "Email", dataIndex: "email" },
    {
      title: "Peran",
      dataIndex: "peran",
      render: (v) => <Tag color="blue">{v}</Tag>,
    },
    { title: "Status", dataIndex: "statusAktif", render: (v) => v ? <Tag color="green">Aktif</Tag> : <Tag>Nonaktif</Tag> },
    { title: "Terakhir Login", dataIndex: "terakhirLogin", render: (v) => v ? dayjs(v).format("DD MMM YYYY HH:mm") : "-" },
    {
      title: "Aksi",
      render: (r) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => {
            setEditing(r);
            form.setFieldsValue(r);
            setOpen(true);
          }}>
            Edit
          </Button>
          <Button size="small" icon={<KeyOutlined />} onClick={() => onResetPwd(r)}>
            Reset Pwd
          </Button>
          <Button size="small" onClick={() => onToggleStatus(r)}>
            {r.statusAktif ? "Nonaktifkan" : "Aktifkan"}
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Pengguna Sistem"
        actions={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setOpen(true); }}>
            Tambah Pengguna
          </Button>
        }
      />
      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <Input.Search
            placeholder="Cari nama / username"
            allowClear
            style={{ width: 260 }}
            onSearch={(v) => {
              setFilter((f) => ({ ...f, search: v }));
              fetchData({ page: 1 });
            }}
          />
          <Select
            placeholder="Peran"
            allowClear
            style={{ minWidth: 180 }}
            value={filter.peran || undefined}
            onChange={(v) => setFilter((f) => ({ ...f, peran: v || "" }))}
            options={PERAN_OPTIONS}
          />
          <Select
            placeholder="Status"
            allowClear
            style={{ minWidth: 140 }}
            value={filter.statusAktif || undefined}
            onChange={(v) => setFilter((f) => ({ ...f, statusAktif: v || "" }))}
            options={[{ value: "true", label: "Aktif" }, { value: "false", label: "Nonaktif" }]}
          />
          <Button icon={<ReloadOutlined />} onClick={() => setFilter({ peran: "", statusAktif: "", search: "" })}>
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
            showTotal: (t) => `Total ${t} pengguna`,
            onChange: (page, pageSize) => {
              setPagination((p) => ({ ...p, current: page, pageSize }));
              fetchData({ page, limit: pageSize });
            },
          }}
          scroll={{ x: 1100 }}
        />
      </Card>

      <Modal
        title={editing ? "Edit Pengguna" : "Tambah Pengguna"}
        open={open}
        onCancel={() => { setOpen(false); setEditing(null); }}
        onOk={() => form.submit()}
        width={680}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={onSubmit}>
          <Form.Item label="Nama Lengkap" name="namaLengkap" rules={[{ required: true, min: 2 }]}>
            <Input />
          </Form.Item>
          <Form.Item label="Username" name="username" rules={[{ required: !editing, pattern: /^[A-Za-z0-9_]{3,50}$/, message: "3-50 karakter alfanumerik & underscore" }]}>
            <Input disabled={!!editing} />
          </Form.Item>
          <Form.Item label="Email" name="email" rules={[{ required: true, type: "email" }]}>
            <Input />
          </Form.Item>
          <Form.Item label="Peran" name="peran" rules={[{ required: true }]}>
            <Select options={PERAN_OPTIONS} />
          </Form.Item>
          {peranWatch === "OPERATOR_SPPG" || peranWatch === "ASISTEN_LAPANGAN" ? (
            <Form.Item label="SPPG" name="sppgId" rules={[{ required: true }]}>
              <Select showSearch options={sppgOptions.map((s) => ({ value: s.id, label: s.namaSppg }))} filterOption={(i, o) => (o.label || "").toLowerCase().includes(i.toLowerCase())} />
            </Form.Item>
          ) : null}
          {peranWatch === "PENGAWAS_GIZI" ? (
            <Form.Item label="Wilayah / Provinsi" name="wilayahZona" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
          ) : null}
          {!editing ? (
            <>
              <Form.Item label="Password" name="password" rules={[{ required: true, min: 8 }]}>
                <Input.Password onChange={(e) => setPwd(e.target.value)} />
              </Form.Item>
              <Progress percent={strength(pwd)} status={strength(pwd) >= 80 ? "success" : "active"} />
            </>
          ) : null}
        </Form>
      </Modal>
    </div>
  );
}
