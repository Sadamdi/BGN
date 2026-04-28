import api from "./axios";

export const list = () => api.get("/notifikasi").then((r) => r.data);
export const tandaiDibaca = (ids) => api.patch("/notifikasi/tandai-dibaca", { ids }).then((r) => r.data);
export const tandaiSemua = () => api.patch("/notifikasi/tandai-semua").then((r) => r.data);
