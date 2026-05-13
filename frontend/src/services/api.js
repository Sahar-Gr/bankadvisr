// src/services/api.js
import axios from "axios";
import { getConsultanteUid } from "./authUid";

export const api = axios.create({
  baseURL: "http://localhost:8080/api", // ajuste au besoin
});

// Interceptor request (async): ajoute X-Demo-Uid
api.interceptors.request.use(async (config) => {
  try {
    const uid = await getConsultanteUid();
    if (uid) config.headers["X-Demo-Uid"] = uid;
  } catch (e) {
    console.warn("X-Demo-Uid not set:", e);
  }
  return config;
});

// Interceptor response: gestion simple 401/403
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const s = err?.response?.status;
    if (s === 401 || s === 403) {
      console.warn("Auth/permission error", s);
      // en V0, on reste sur la page consultante; décommente si tu veux rediriger :
      // if (window.location.pathname !== "/login") window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

// helper optionnel (si tes pages l’utilisent)
export const batchUsers = (uids = []) =>
  api.post("/users/batch", { uids }).then((r) => r.data);
