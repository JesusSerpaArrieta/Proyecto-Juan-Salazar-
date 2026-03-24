import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api/",
});

api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem("access");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      sessionStorage.getItem("refresh")
    ) {
      originalRequest._retry = true;
      try {
        const baseURL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api/";
        const res = await axios.post(`${baseURL}refresh/`, {
          refresh: sessionStorage.getItem("refresh"),
        });

        sessionStorage.setItem("access", res.data.access);
        originalRequest.headers.Authorization = `Bearer ${res.data.access}`;

        return api(originalRequest);
      } catch {
        sessionStorage.removeItem("access");
        sessionStorage.removeItem("refresh");
        window.location.href = "/";
      }
    }

    return Promise.reject(error);
  }
);

export default api;
