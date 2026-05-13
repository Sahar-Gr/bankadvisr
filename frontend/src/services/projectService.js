import axios from "axios";
const API_URL = "http://localhost:8080/api/admin";
const headers = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } });

export const getProjects = async (clientUid) => {
  const r = await axios.get(`${API_URL}/projects`, { params: { clientUid }, ...headers() });
  return r.data;
};

export const createProject = async (payload) => {
  const r = await axios.post(`${API_URL}/projects`, payload, headers());
  return r.data;
};

export const patchProject = async (id, payload) => {
  const r = await axios.patch(`${API_URL}/projects/${id}`, payload, headers()); // <-- PATCH + /projects/{id}
  return r.data;
};
