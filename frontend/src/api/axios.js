import axios from "axios";
import { message } from "antd";
import { useAuthStore } from "../store/authStore.js";

const baseURL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? "http://localhost:3000/api" : "/api");

const api = axios.create({
  baseURL,
  withCredentials: true,
  timeout: 30000,
});

let refreshing = null;

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

async function doRefresh() {
  const { refreshToken } = useAuthStore.getState();
  if (!refreshToken) throw new Error("NO_REFRESH");
  const r = await axios.post(`${baseURL}/auth/refresh`, { refreshToken });
  const newAccess = r.data && r.data.data && r.data.data.accessToken;
  const refreshedUser = r.data && r.data.data && r.data.data.user;
  if (!newAccess) throw new Error("NO_NEW_TOKEN");
  useAuthStore.getState().setSession({
    user: refreshedUser || useAuthStore.getState().user,
    accessToken: newAccess,
    refreshToken,
  });
  return newAccess;
}

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config || {};
    const status = err.response && err.response.status;
    const data = err.response && err.response.data;

    if (status === 401 && !original._retry && data && data.code !== "INVALID_CREDENTIALS" && data.code !== "ACCOUNT_LOCKED") {
      original._retry = true;
      try {
        if (!refreshing) refreshing = doRefresh().finally(() => (refreshing = null));
        const newToken = await refreshing;
        original.headers = original.headers || {};
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      } catch (e) {
        useAuthStore.getState().clearSession();
        if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
          window.location.href = "/login";
        }
        return Promise.reject(err);
      }
    }

    if (status === 403) {
      message.error((data && data.message) || "Akses ditolak");
    } else if (status >= 500) {
      message.error((data && data.message) || "Terjadi kesalahan server");
    }

    return Promise.reject(err);
  }
);

export default api;
