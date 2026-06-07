const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string) || "http://127.0.0.1:8000";

export function resolveApiUrl(url?: string | null) {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("/")) return `${API_BASE_URL}${url}`;
  return `${API_BASE_URL}/${url}`;
}