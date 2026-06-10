import axios, { AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from "axios";
import { useAuthStore } from "@/store/auth.store";

const api: AxiosInstance = axios.create({
  baseURL: "/api",
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().accessToken;
  if (token && config.headers) {
    config.headers["Authorization"] = `Bearer ${token}`;
  }
  return config;
});

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (err: unknown) => void;
}> = [];

function processQueue(err: unknown, token: string | null = null) {
  failedQueue.forEach((p) => (err ? p.reject(err) : p.resolve(token!)));
  failedQueue = [];
}

api.interceptors.response.use(
  (res: AxiosResponse) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            original.headers["Authorization"] = `Bearer ${token}`;
            return api(original);
          })
          .catch((err) => Promise.reject(err));
      }

      original._retry = true;
      isRefreshing = true;

      try {
        const { refreshToken, setAuth, logout } = useAuthStore.getState();
        if (!refreshToken) throw new Error("No refresh token");

        const resp = await axios.post("/api/auth/refresh", { refresh_token: refreshToken });
        const { access_token, refresh_token } = resp.data;
        setAuth(useAuthStore.getState().user!, access_token, refresh_token);

        processQueue(null, access_token);
        original.headers["Authorization"] = `Bearer ${access_token}`;
        return api(original);
      } catch (err) {
        processQueue(err, null);
        useAuthStore.getState().logout();
        window.location.href = "/";
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);

export default api;

/**
 * Extract a human-readable string from any Axios error.
 * FastAPI 422 detail is an array of {type,loc,msg,input} objects.
 * FastAPI 400/403/404 detail is a string.
 * Our AppException returns {error, message, detail}.
 */
export function apiError(err: unknown, fallback = "Something went wrong."): string {
  const data = (err as any)?.response?.data;
  if (!data) return fallback;

  // Our custom AppException shape
  if (typeof data.message === "string" && data.message) return data.message;

  // FastAPI 422 validation errors — array of {msg, loc}
  if (Array.isArray(data.detail)) {
    return data.detail
      .map((e: any) => {
        const field = Array.isArray(e.loc) ? e.loc.slice(1).join(".") : "";
        return field ? `${field}: ${e.msg}` : e.msg;
      })
      .join("; ");
  }

  // FastAPI plain string detail
  if (typeof data.detail === "string" && data.detail) return data.detail;

  return fallback;
}
