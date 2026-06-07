import axios from "axios";

const baseURL = (import.meta.env.VITE_API_BASE_URL as string) || "http://127.0.0.1:8000";

const api = axios.create({
  baseURL,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
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
      const token = localStorage.getItem("token");
      const requestUrl = String(error?.config?.url || "");
      const isAuthRequest = requestUrl.includes("/login/") || requestUrl.includes("/users/register");

      if (token && !isAuthRequest) {
        localStorage.removeItem("token");
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export default api;