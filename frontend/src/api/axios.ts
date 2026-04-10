import axios from "axios";

const envBaseURL = ((import.meta.env.VITE_API_BASE_URL as string) || "").trim();
const baseURL = envBaseURL || "http://127.0.0.1:8000";
const isNgrokBase = baseURL.includes("ngrok-free.dev") || baseURL.includes("ngrok.app");

const api = axios.create({
  baseURL,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  if (isNgrokBase && config.headers) {
    config.headers["ngrok-skip-browser-warning"] = "true";
  }
  const token = localStorage.getItem("token");
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      localStorage.removeItem("token");
      // редирект на login
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default api;