import React, { useEffect, useMemo, useState } from "react";
import {
  getClients,
  deleteClient,
  toggleClientActive,
  createClient,
  updateClient,
} from "../../../services/adminService";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "../../../firebase/firebase";
import { useToast } from "../../ui/Toast";
import {
  validateName,
  validateE164,
  normalizeE164,
  isDirtyClient,
  trimStr,
} from "../../../utils/validation";
import { Users, Plus, Pencil, Trash2, RotateCcw, UserX, X } from "lucide-react";

const displayWa = (v) => (v ? String(v).replace(/\s+/g, "") : "N/A");

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div
        className="app-card w-full max-w-2xl p-6"
        style={{ background: "var(--bg-card)" }}
      >
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="app-btn app-btn-ghost p-2 rounded-lg"
            aria-label="Fermer"
            title="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function ClientList() {
  const toast = useToast();

  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);

  const [showEditModal, setShowEditModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);

  const [newClient, setNewClient] = useState({
    email: "",
    password: "",
    nom: "",
    prenom: "",
    numeroWhatsApp: "",
  });

  const [editData, setEditData] = useState({
    nom: "",
    prenom: "",
    numeroWhatsApp: "",
    active: true,
  });

  const [errors, setErrors] = useState({});

  async function load() {
    try {
      setLoading(true);
      const data = await getClients();
      setClients(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      toast.error("Échec du chargement des clients.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const dirty = useMemo(() => {
    if (!selectedClient) return false;
    return isDirtyClient(selectedClient, editData);
  }, [selectedClient, editData]);

  function openCreateModal() {
    setErrors({});
    setNewClient({
      email: "",
      password: "",
      nom: "",
      prenom: "",
      numeroWhatsApp: "",
    });
    setShowCreateModal(true);
  }

  function closeCreateModal() {
    if (creating) return;
    setShowCreateModal(false);
    setErrors({});
  }

  function openEditModal(client) {
    setSelectedClient(client);
    setEditData({
      nom: client.nom || "",
      prenom: client.prenom || "",
      numeroWhatsApp: client.numeroWhatsApp || "",
      active: client.active ?? true,
    });
    setErrors({});
    setShowEditModal(true);
  }

  function closeEditModal() {
    if (saving) return;
    if (selectedClient && dirty) {
      const ok = window.confirm("Des modifications non enregistrées seront perdues. Continuer ?");
      if (!ok) return;
    }
    setShowEditModal(false);
    setSelectedClient(null);
    setErrors({});
  }

  function validateEdit() {
    const e = {};
    if (!validateName(editData.nom)) e.nom = "Nom trop court (min 2 caractères).";
    if (!validateName(editData.prenom)) e.prenom = "Prénom trop court (min 2 caractères).";
    if (!validateE164(editData.numeroWhatsApp)) {
      e.numeroWhatsApp = "Format invalide. Exemple : +21650123456";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function validateCreate() {
    const e = {};
    if (!newClient.email) e.email = "Email requis.";
    if (!newClient.password) e.password = "Mot de passe requis.";
    if (!validateName(newClient.nom)) e.nom = "Nom trop court (min 2 caractères).";
    if (!validateName(newClient.prenom)) e.prenom = "Prénom trop court (min 2 caractères).";
    if (!validateE164(newClient.numeroWhatsApp)) {
      e.numeroWhatsApp = "Format invalide. Exemple : +21650123456";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function saveEdit() {
    if (!selectedClient) return;
    if (!validateEdit()) return;
    if (!dirty) return;

    try {
      setSaving(true);

      const payload = {
        nom: trimStr(editData.nom),
        prenom: trimStr(editData.prenom),
        numeroWhatsApp: normalizeE164(editData.numeroWhatsApp),
        active: !!editData.active,
      };

      await updateClient(selectedClient.uid, payload);
      toast.success("Client mis à jour.");

      setRefreshing(true);
      const data = await getClients();
      setClients(Array.isArray(data) ? data : []);
      setRefreshing(false);

      setShowEditModal(false);
      setSelectedClient(null);
      setErrors({});
    } catch (e) {
      console.error(e);
      toast.error("Échec de la mise à jour.");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(uid, label) {
    const ok = window.prompt(
      `Pour confirmer la suppression, tapez le nom du client :\n\n${label}`
    );
    if (ok !== label) return;

    try {
      await deleteClient(uid);
      toast.success("Client supprimé.");
      setClients((prev) => prev.filter((c) => c.uid !== uid));
    } catch (e) {
      console.error(e);
      toast.error("Échec de la suppression.");
    }
  }

  async function onToggle(uid, current, label) {
    const action = current ? "Désactiver" : "Restaurer";
    if (!window.confirm(`${action} ${label} ?`)) return;

    try {
      await toggleClientActive(uid, !current);
      toast.success(`${action} : OK`);
      setClients((prev) =>
        prev.map((c) => (c.uid === uid ? { ...c, active: !current } : c))
      );
    } catch (e) {
      console.error(e);
      toast.error("Échec de la mise à jour de l'état.");
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!validateCreate()) return;

    try {
      setCreating(true);

      const cred = await createUserWithEmailAndPassword(
        auth,
        newClient.email,
        newClient.password
      );

      const uid = cred.user.uid;

      const payload = {
        uid,
        email: newClient.email,
        nom: trimStr(newClient.nom),
        prenom: trimStr(newClient.prenom),
        numeroWhatsApp: normalizeE164(newClient.numeroWhatsApp),
        active: true,
        role: "client",
      };

      const created = await createClient(payload);

      toast.success("Client créé.");
      setClients((prev) => [...prev, created]);

      setShowCreateModal(false);
      setNewClient({
        email: "",
        password: "",
        nom: "",
        prenom: "",
        numeroWhatsApp: "",
      });
      setErrors({});
    }catch (e) {
  console.error(e);

  if (e.code === "auth/email-already-in-use") {
    toast.error("Cet email est déjà utilisé.");
  } else if (e.code === "auth/invalid-email") {
    toast.error("Email invalide.");
  } else if (e.code === "auth/weak-password") {
    toast.error("Mot de passe trop faible (min 6 caractères).");
  } else {
    toast.error("Échec de la création.");
  }
} finally {
      setCreating(false);
    }
  }

  return (
    <div className="page-container py-8">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-3" style={{ color: "var(--brand)" }}>
            <Users className="h-7 w-7" />
            <h1 className="text-3xl font-bold">Liste des clients</h1>
          </div>
          <p className="text-secondary">
            Gérez les comptes clients, leur statut et leurs informations principales.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="app-btn app-btn-primary"
          type="button"
        >
          <Plus className="h-4 w-4" />
          <span>Créer un client</span>
        </button>
      </div>

      {loading ? (
        <p className="text-center">Chargement...</p>
      ) : clients.length === 0 ? (
        <div className="app-card p-8 text-center">
          <p className="text-secondary">Aucun client trouvé.</p>
        </div>
      ) : (
        <div className="app-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead
  style={{
    background: "var(--bg-muted)",
    color: "var(--text-primary)",
    borderBottom: "1px solid var(--border-strong)",
  }}
>
                <tr className="text-left text-[13px] font-semibold uppercase tracking-[0.04em]">
                  <th className="px-6 py-4 font-semibold">Nom</th>
                  <th className="px-6 py-4 font-semibold">Prénom</th>
                  <th className="px-6 py-4 font-semibold">Email</th>
                  <th className="px-6 py-4 font-semibold">WhatsApp</th>
                  <th className="px-6 py-4 font-semibold">État</th>
                  <th className="px-6 py-4 font-semibold">Actions</th>
                </tr>
              </thead>

              <tbody>
                {clients.map((c) => (
                  <tr
                    key={c.uid}
                    style={{ borderTop: "1px solid var(--border-soft)" }}
                    className="align-top"
                  >
                    <td className="px-6 py-4">{c.nom || "N/A"}</td>
                    <td className="px-6 py-4">{c.prenom || "N/A"}</td>
                    <td className="px-6 py-4">{c.email || "N/A"}</td>
                    <td className="px-6 py-4">{displayWa(c.numeroWhatsApp)}</td>
                    <td className="px-6 py-4">
                      {c.active ? (
                        <span className="status-badge status-active">Actif</span>
                      ) : (
                        <span className="status-badge status-inactive">Désactivé</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => openEditModal(c)}
                          className="app-btn app-btn-secondary"
                          type="button"
                        >
                          <Pencil className="h-4 w-4" />
                          <span>Modifier</span>
                        </button>

                        <button
                          onClick={() => onDelete(c.uid, `${c.nom}`)}
                          className="app-btn app-btn-danger"
                          type="button"
                        >
                          <Trash2 className="h-4 w-4" />
                          <span>Supprimer</span>
                        </button>

                        <button
                          onClick={() => onToggle(c.uid, c.active, `${c.nom}`)}
                          className={`app-btn ${c.active ? "app-btn-warning" : "app-btn-success"}`}
                          type="button"
                        >
                          {c.active ? (
                            <>
                              <UserX className="h-4 w-4" />
                              <span>Désactiver</span>
                            </>
                          ) : (
                            <>
                              <RotateCcw className="h-4 w-4" />
                              <span>Restaurer</span>
                            </>
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {refreshing && (
            <div className="px-6 py-3 text-xs text-muted">Rafraîchissement…</div>
          )}
        </div>
      )}

      {showCreateModal && (
        <Modal title="Créer un client" onClose={closeCreateModal}>
          <form onSubmit={handleCreate} className="space-y-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm text-secondary">Nom</label>
                <input
                  type="text"
                  value={newClient.nom}
                  onChange={(e) => setNewClient({ ...newClient, nom: e.target.value })}
                  className="app-input"
                  placeholder="Nom"
                />
                {errors.nom && <p className="text-sm" style={{ color: "var(--danger)" }}>{errors.nom}</p>}
              </div>

              <div className="space-y-2">
                <label className="text-sm text-secondary">Prénom</label>
                <input
                  type="text"
                  value={newClient.prenom}
                  onChange={(e) => setNewClient({ ...newClient, prenom: e.target.value })}
                  className="app-input"
                  placeholder="Prénom"
                />
                {errors.prenom && <p className="text-sm" style={{ color: "var(--danger)" }}>{errors.prenom}</p>}
              </div>

              <div className="space-y-2">
                <label className="text-sm text-secondary">Email</label>
                <input
                  type="email"
                  value={newClient.email}
                  onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
                  className="app-input"
                  placeholder="Email"
                />
                {errors.email && <p className="text-sm" style={{ color: "var(--danger)" }}>{errors.email}</p>}
              </div>

              <div className="space-y-2">
                <label className="text-sm text-secondary">Mot de passe</label>
                <input
                  type="password"
                  value={newClient.password}
                  onChange={(e) => setNewClient({ ...newClient, password: e.target.value })}
                  className="app-input"
                  placeholder="Mot de passe"
                />
                {errors.password && <p className="text-sm" style={{ color: "var(--danger)" }}>{errors.password}</p>}
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-sm text-secondary">Numéro WhatsApp</label>
                <input
                  type="text"
                  value={newClient.numeroWhatsApp}
                  onChange={(e) =>
                    setNewClient({ ...newClient, numeroWhatsApp: e.target.value })
                  }
                  className="app-input"
                  placeholder="Exemple : +21650123456"
                />
                {errors.numeroWhatsApp && (
                  <p className="text-sm" style={{ color: "var(--danger)" }}>
                    {errors.numeroWhatsApp}
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={closeCreateModal}
                className="app-btn app-btn-ghost"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={creating}
                className="app-btn app-btn-primary"
              >
                {creating ? "Création…" : "Créer"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {showEditModal && selectedClient && (
        <Modal title="Modifier le client" onClose={closeEditModal}>
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm text-secondary">Nom</label>
                <input
                  type="text"
                  value={editData.nom}
                  onChange={(e) => setEditData({ ...editData, nom: e.target.value })}
                  className="app-input"
                  placeholder="Nom"
                />
                {errors.nom && <p className="text-sm" style={{ color: "var(--danger)" }}>{errors.nom}</p>}
              </div>

              <div className="space-y-2">
                <label className="text-sm text-secondary">Prénom</label>
                <input
                  type="text"
                  value={editData.prenom}
                  onChange={(e) => setEditData({ ...editData, prenom: e.target.value })}
                  className="app-input"
                  placeholder="Prénom"
                />
                {errors.prenom && <p className="text-sm" style={{ color: "var(--danger)" }}>{errors.prenom}</p>}
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-sm text-secondary">Numéro WhatsApp</label>
                <input
                  type="text"
                  value={editData.numeroWhatsApp}
                  onChange={(e) =>
                    setEditData({ ...editData, numeroWhatsApp: e.target.value })
                  }
                  className="app-input"
                  placeholder="Exemple : +21650123456"
                />
                {errors.numeroWhatsApp && (
                  <p className="text-sm" style={{ color: "var(--danger)" }}>
                    {errors.numeroWhatsApp}
                  </p>
                )}
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-sm text-secondary">État du compte</label>
                <select
                  value={editData.active ? "1" : "0"}
                  onChange={(e) =>
                    setEditData({ ...editData, active: e.target.value === "1" })
                  }
                  className="app-input"
                >
                  <option value="1">Actif</option>
                  <option value="0">Désactivé</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={closeEditModal}
                className="app-btn app-btn-ghost"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={saveEdit}
                disabled={saving || !dirty}
                className="app-btn app-btn-primary"
              >
                {saving ? "Enregistrement…" : "Enregistrer"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}