// src/services/clientApi.js
import axios from "axios";

const API = "http://localhost:8080/api";
const auth = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } });

// Projets
export async function getMyProjects() {
  const { data } = await axios.get(`${API}/client/projects`, auth());
  return data || [];
}
export async function getMyProject(id) {
  const { data } = await axios.get(`${API}/client/projects/${id}`, auth());
  return data || null;
}
export async function getProjectDocs(projectId) {
  const { data } = await axios.get(`${API}/client/projects/${projectId}/documents`, auth());
  return data || [];
}
export async function uploadClientDoc(projectId, file, onUploadProgress) {
  const form = new FormData();
  form.append("file", file);
  const { data } = await axios.post(
    `${API}/client/projects/${projectId}/documents`,
    form,
    { ...auth(), onUploadProgress }
  );
  return data;
}

// 🔹 NOUVEAU : liste des consultantes pour le dropdown
export async function getConsultantes() {
  const { data } = await axios.get(`${API}/client/consultantes`, auth());
  return Array.isArray(data) ? data : [];
}

// Slots disponibles (client endpoint, fallback admin)
export async function getAvailableSlots(consultanteId, from, to) {
  try {
    const { data } = await axios.get(`${API}/client/creneaux-disponibles`, {
      ...auth(), params: { consultanteId, from, to }
    });
    return data || [];
  } catch (e) {
    if (e?.response?.status === 404 || e?.response?.status === 405) {
      const { data } = await axios.get(`${API}/admin/creneaux-disponibles`, {
        ...auth(), params: { consultanteId, from, to }
      });
      return data || [];
    }
    throw e;
  }
}

// Mes RDV
export async function getMyAppointments(from, to) {
  try {
    const { data } = await axios.get(`${API}/client/rendezvous`, {
      ...auth(), params: { from, to }
    });
    return data || [];
  } catch (e) {
    const { data } = await axios.get(`${API}/client/rdv`, auth());
    return data || [];
  }
}

// Réserver (client endpoint, fallback général)
export async function bookRdv(payload) {
  try {
    const { data } = await axios.post(`${API}/client/rendezvous`, payload, auth());
    return data;
  } catch (e) {
    const { data } = await axios.post(`${API}/rendezvous`, payload, auth());
    return data;
  }
}
