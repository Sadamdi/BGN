import api from "./axios";

export function login(payload) {
  return api.post("/auth/login", payload).then((r) => r.data);
}

export function logout() {
  return api.post("/auth/logout").then((r) => r.data);
}

export function me() {
  return api.get("/auth/me").then((r) => r.data);
}

export function forgotPassword(email) {
  return api.post("/auth/forgot-password", { email }).then((r) => r.data);
}

export function resetPassword(token, password) {
  return api.post(`/auth/reset-password/${token}`, { password }).then((r) => r.data);
}

export function ubahPassword(payload) {
  return api.post("/auth/ubah-password", payload).then((r) => r.data);
}
