import api from "./axios";

export const getStatistik = () => api.get("/dashboard/statistik").then((r) => r.data);
export const getTrenDistribusi = (range = 30) => api.get("/dashboard/tren-distribusi", { params: { range } }).then((r) => r.data);
export const getSebaranSppg = () => api.get("/dashboard/sebaran-sppg").then((r) => r.data);
export const getDistribusiKategori = () => api.get("/dashboard/distribusi-kategori").then((r) => r.data);
export const getAlert = () => api.get("/dashboard/alert").then((r) => r.data);
