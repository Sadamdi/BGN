import api from "./axios";

export const previewDistribusi = (filter) => api.post("/laporan/distribusi/preview", filter).then((r) => r.data);
export const previewStatusGizi = (filter) => api.post("/laporan/status-gizi/preview", filter).then((r) => r.data);
export const previewKinerjaSppg = (filter) => api.post("/laporan/kinerja-sppg/preview", filter).then((r) => r.data);
export const previewPenerima = (filter) => api.post("/laporan/penerima/preview", filter).then((r) => r.data);

export function exportExcel(jenis, filter) {
  return api.post(`/laporan/${jenis}/excel`, filter, { responseType: "blob" }).then((r) => r.data);
}

export function exportPdf(filter) {
  return api.post("/laporan/distribusi/pdf", filter, { responseType: "blob" }).then((r) => r.data);
}

export const listJadwal = () => api.get("/laporan/jadwal").then((r) => r.data);
export const buatJadwal = (payload) => api.post("/laporan/jadwal", payload).then((r) => r.data);
export const toggleJadwal = (id) => api.patch(`/laporan/jadwal/${id}/toggle`).then((r) => r.data);
export const hapusJadwal = (id) => api.delete(`/laporan/jadwal/${id}`).then((r) => r.data);
