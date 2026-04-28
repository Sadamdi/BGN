import api from "./axios";

export function getRingkasanPublik(tahun) {
  const params = tahun ? { tahun } : {};
  return api.get("/public-data/ringkasan", { params }).then((r) => r.data);
}

export function getRealtimeSummary() {
  return api.get("/public-data/realtime-summary").then((r) => r.data);
}

export function createRealtimeStream(onEvent, onError) {
  const tokenRaw = localStorage.getItem("sipgn-auth");
  let accessToken = null;
  try {
    accessToken = tokenRaw ? JSON.parse(tokenRaw)?.state?.accessToken : null;
  } catch (_) {
    accessToken = null;
  }
  const base = import.meta.env.VITE_SOCKET_URL || window.location.origin;
  const url = new URL("/api/public-data/realtime-stream", base);
  if (accessToken) url.searchParams.set("token", accessToken);
  const es = new EventSource(url.toString());
  es.onmessage = (evt) => onEvent && onEvent("message", evt.data);
  es.addEventListener("DAILY_METRIC_BATCH_CREATED", (evt) => onEvent && onEvent("batch", evt.data));
  es.addEventListener("ping", (evt) => onEvent && onEvent("ping", evt.data));
  es.onerror = (err) => onError && onError(err);
  return es;
}
