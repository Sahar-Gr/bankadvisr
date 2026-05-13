import axios from "axios";

const API_URL = "http://localhost:8080/api/admin";

const getAuthHeaders = () => ({
  headers: {
    Authorization: `Bearer ${localStorage.getItem("token")}`,
    "Content-Type": "application/json",
  },
});

// 1) Liste des clients
export const getClients = async () => {
  const r = await axios.get(`${API_URL}/clients`, getAuthHeaders());
  return r.data; // payload dans response.data
};

// 2) Supprimer un client
export const deleteClient = async (clientId) => {
  await axios.delete(`${API_URL}/clients/${clientId}`, getAuthHeaders());
};

// 3) Activer/Désactiver
export const toggleClientActive = async (uid, active) => {
  await axios.put(
    `${API_URL}/clients/${uid}/active`,
    null,
    { ...getAuthHeaders(), params: { active } }
  );
};

// 4) Créer le client Firestore
export const createClient = async (clientData) => {
  const r = await axios.post(`${API_URL}/clients`, clientData, getAuthHeaders());
  return r.data; // on renvoie l'objet créé (avec uid)
};
// ✅ PUT /clients/:uid  ← manquait dans tes exports
export const updateClient = async (uid, updates) => {
  const r = await axios.put(`${API_URL}/clients/${uid}`, updates, getAuthHeaders());
  return r.data;
};


////////


// Projets
export const createProject = async (payload) => {
  const r = await axios.post(`${API_URL}/projects`, payload, getAuthHeaders());
  return r.data;
};

export const getProjects = async (clientUid) => {
  const r = await axios.get(`${API_URL}/projects`, {
    ...getAuthHeaders(),
    params: clientUid ? { clientUid } : {},
  });
  return r.data;
};

export const patchProject = async (id, patch) => {
  const r = await axios.patch(`${API_URL}/projects/${id}`, patch, getAuthHeaders());
  return r.data;
};
