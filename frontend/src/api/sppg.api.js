import api from "./axios";

export const list = (params) => api.get("/sppg", { params }).then((r) => r.data);
export const detail = (id) => api.get(`/sppg/${id}`).then((r) => r.data);
export const create = (payload) => api.post("/sppg", payload).then((r) => r.data);
export const update = (id, payload) => api.put(`/sppg/${id}`, payload).then((r) => r.data);
export const toggleStatus = (id) => api.patch(`/sppg/${id}/status`).then((r) => r.data);
export const exportGeoJSON = () => api.get("/sppg/export-geojson").then((r) => r.data);
export const provinsiList = () => api.get("/sppg/provinsi-list").then((r) => r.data);
