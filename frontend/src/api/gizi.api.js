import api from "./axios";

export const create = (payload) => api.post("/gizi", payload).then((r) => r.data);
export const riwayat = (penerimaId, params) => api.get(`/gizi/penerima/${penerimaId}`, { params }).then((r) => r.data);
export const prevalensi = (params) => api.get("/gizi/prevalensi", { params }).then((r) => r.data);
export const standarAKG = () => api.get("/gizi/standar-akg").then((r) => r.data);
