// src/components/dashboard/consultante/ClientLists.jsx
import React, { useEffect, useMemo, useState } from "react";
import { getClients, updateClient } from "../../../services/adminService";
import { useToast } from "../../ui/Toast";
import {
  validateName,
  validateE164,
  normalizeE164,
  isDirtyClient,
  trimStr,
} from "../../../utils/validation";
import { Users, Pencil, X } from "lucide-react";

const displayWa = (v) => (v ? String(v).replace(/\s+/g, "") : "N/A");

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="app-card w-full max-w-2xl p-6" style={{ background: "var(--bg-card)" }}>
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-semibold">{title}</h2>
          <button type="button" onClick={onClose} className="app-btn app-btn-ghost p-2 rounded-lg">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function ClientListConsultante() {
  const toast = useToast();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [editData, setEditData] = useState({ nom: "", prenom: "", numeroWhatsApp: "" });
  const [errors, setErrors] = useState({});

  async function load() {
    try {
      setLoading(true);
      const data = await getClients();
      setClients(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      // On retire le toast d'erreur ici temporairement pour éviter qu'il ne spamme si l'API bloque
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const dirty = useMemo(() => {
    if (!selectedClient) return false;
    return isDirtyClient(selectedClient, editData);
  }, [selectedClient, editData]);

  function openEditModal(client) {
    setSelectedClient(client);
    setEditData({
      nom: client.nom || "",
      prenom: client.prenom || "",
      numeroWhatsApp: client.numeroWhatsApp || "",
    });
    setErrors({});
    setShowEditModal(true);
  }

  function closeEditModal() {
    if (saving) return;
    if (selectedClient && dirty && !window.confirm("Ignorer les modifications ?")) return;
    setShowEditModal(false);
    setSelectedClient(null);
    setErrors({});
  }

  function validateEdit() {
    const e = {};
    if (!validateName(editData.nom)) e.nom = "Min 2 caractères.";
    if (!validateName(editData.prenom)) e.prenom = "Min 2 caractères.";
    if (!validateE164(editData.numeroWhatsApp)) e.numeroWhatsApp = "Format invalide (+216...).";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function saveEdit() {
    if (!selectedClient || !validateEdit() || !dirty) return closeEditModal();
    try {
      setSaving(true);
      const payload = {
        nom: trimStr(editData.nom),
        prenom: trimStr(editData.prenom),
        numeroWhatsApp: normalizeE164(editData.numeroWhatsApp),
      };
      await updateClient(selectedClient.uid, payload);
      toast.success("Client mis à jour.");
      setClients(prev => prev.map(c => c.uid === selectedClient.uid ? { ...c, ...payload } : c));
      closeEditModal();
    } catch (e) {
      toast.error("Échec de la mise à jour.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="animate-fade-in pt-4">
      <div className="mb-8">
        <div className="mb-2 flex items-center gap-3 text-brand">
          <Users className="h-8 w-8" />
          <h1 className="page-title text-text-primary">Mes Clients</h1>
        </div>
        <p className="text-text-secondary">Consultez les informations de vos clients.</p>
      </div>

      {loading ? (
        <div className="app-card p-12 text-center text-muted animate-pulse">Chargement...</div>
      ) : clients.length === 0 ? (
        <div className="app-card p-12 text-center text-text-secondary">Aucun client trouvé.</div>
      ) : (
        <div className="app-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-bg-surface border-b border-border-strong text-xs uppercase tracking-wider text-text-muted">
                <tr>
                  <th className="px-6 py-4 font-semibold">Nom</th>
                  <th className="px-6 py-4 font-semibold">Prénom</th>
                  <th className="px-6 py-4 font-semibold">Email</th>
                  <th className="px-6 py-4 font-semibold">WhatsApp</th>
                  <th className="px-6 py-4 font-semibold">État</th>
                  <th className="px-6 py-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-soft">
                {clients.map((c) => (
                  <tr key={c.uid} className="hover:bg-bg-muted/30 transition-colors">
                    <td className="px-6 py-4 font-medium text-text-primary">{c.nom || "—"}</td>
                    <td className="px-6 py-4 font-medium text-text-primary">{c.prenom || "—"}</td>
                    <td className="px-6 py-4 text-text-secondary">{c.email || "—"}</td>
                    <td className="px-6 py-4 text-text-secondary">{displayWa(c.numeroWhatsApp)}</td>
                    <td className="px-6 py-4">
                      {c.active ? <span className="status-badge status-active">Actif</span> : <span className="status-badge status-inactive">Désactivé</span>}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button onClick={() => openEditModal(c)} className="app-btn app-btn-secondary text-sm py-1.5 px-3">
                        <Pencil className="h-4 w-4 mr-2" /> Modifier
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showEditModal && selectedClient && (
        <Modal title="Modifier les coordonnées" onClose={closeEditModal}>
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs text-muted font-semibold uppercase">Nom</label>
                <input type="text" value={editData.nom} onChange={(e) => setEditData({ ...editData, nom: e.target.value })} className="app-input" />
                {errors.nom && <p className="text-xs text-danger mt-1">{errors.nom}</p>}
              </div>
              <div className="space-y-2">
                <label className="text-xs text-muted font-semibold uppercase">Prénom</label>
                <input type="text" value={editData.prenom} onChange={(e) => setEditData({ ...editData, prenom: e.target.value })} className="app-input" />
                {errors.prenom && <p className="text-xs text-danger mt-1">{errors.prenom}</p>}
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-xs text-muted font-semibold uppercase">WhatsApp</label>
                <input type="text" value={editData.numeroWhatsApp} onChange={(e) => setEditData({ ...editData, numeroWhatsApp: e.target.value })} className="app-input" />
                {errors.numeroWhatsApp && <p className="text-xs text-danger mt-1">{errors.numeroWhatsApp}</p>}
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-border-soft">
              <button type="button" onClick={closeEditModal} className="app-btn app-btn-ghost">Annuler</button>
              <button type="button" onClick={saveEdit} disabled={saving || !dirty} className="app-btn app-btn-primary">
                {saving ? "Enregistrement…" : "Enregistrer"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}