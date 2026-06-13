import api from "./axios";

export function login(payload) {
  return api.post("/auth/login", payload).then((r) => r.data);
}

export function registerSppg(payload) {
  return api.post("/auth/register-sppg", payload).then((r) => r.data);
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

export function resetPassword(token, password, otp) {
  return api.post(`/auth/reset-password/${token}`, { password, otp }).then((r) => r.data);
}

export function verifyResetOtp(token, otp) {
  return api.post(`/auth/reset-password/${token}/verify-otp`, { otp }).then((r) => r.data);
}

export function ubahPassword(payload) {
  return api.post("/auth/ubah-password", payload).then((r) => r.data);
}

export function updatePreferences(payload) {
  return api.patch("/auth/me/preferences", payload).then((r) => r.data);
}
