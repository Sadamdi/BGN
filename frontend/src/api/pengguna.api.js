import api from "./axios";

export const list = (params) => api.get("/pengguna", { params }).then((r) => r.data);
export const create = (payload) => api.post("/pengguna", payload).then((r) => r.data);
export const update = (id, payload) => api.put(`/pengguna/${id}`, payload).then((r) => r.data);
export const resetPassword = (id, password) => api.patch(`/pengguna/${id}/password`, { password }).then((r) => r.data);
export const toggleStatus = (id) => api.patch(`/pengguna/${id}/status`).then((r) => r.data);
export const remove = (id) => api.delete(`/pengguna/${id}`).then((r) => r.data);
