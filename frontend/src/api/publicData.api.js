import api from "./axios";

export function getRingkasanPublik(tahun) {
  const params = tahun ? { tahun } : {};
  return api.get("/public-data/ringkasan", { params }).then((r) => r.data);
}
