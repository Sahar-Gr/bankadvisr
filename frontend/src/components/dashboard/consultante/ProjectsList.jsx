// src/components/dashboard/consultante/ProjectsList.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getProjects, createProject, patchProject } from "../../../services/projectService";
import { getClients } from "../../../services/adminService";
import { useToast } from "../../ui/Toast";

// couleurs statuts
const STATUTS = [
  { value: "en_cours", label: "En cours" },
  { value: "bloque", label: "Bloqué" },
  { value: "termine", label: "Terminé" },
];

const clampPct = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0;
};

const progressColor = (p) => {
  if (p >= 80) return "bg-success"; // Utilisation de tes variables globales si possible, sinon classes Tailwind standards ci-dessous
  if (p < 20) return "bg-danger";
  return "bg-warning";
};

const StatusChip = ({ value }) => {
  const map = {
    en_cours: "status-progress",
    bloque: "status-inactive",
    termine: "status-active",
  };
  const cls = map[value] || "bg-gray-500 text-white";
  const label =
    value === "en_cours" ? "En cours" :
    value === "bloque"   ? "Bloqué"   :
    value === "termine"  ? "Terminé"  : value;
  return (
    <span className={`status-badge ${cls}`}>
      {label}
    </span>
  );
};

function normalizeClient(raw) {
  const uid = raw?.uid || raw?.id || raw?.userId || "";
  const prenom = raw?.prenom || raw?.firstName || raw?.firstname || "";
  const nom = raw?.nom || raw?.lastName || raw?.lastname || "";
  const email = raw?.email || raw?.mail || "";
  return { uid, prenom, nom, email, _raw: raw };
}

function labelFromClient(c) {
  if (!c) return "—";
  const name = [c.prenom, c.nom].filter(Boolean).join(" ").trim();
  if (name && c.email) return `${name} (${c.email})`;
  return name || c.email || c.uid || "—";
}

export default function ProjectsList() {
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState([]);
  const [projects, setProjects] = useState([]);
  const [clientFilter, setClientFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ clientUid: "", titre: "", description: "" });

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [c, p] = await Promise.all([getClients(), getProjects(clientFilter || undefined)]);
        if (!mounted) return;
        const normalized = (c || []).map(normalizeClient);
        setClients(normalized);
        setProjects(p || []);
      } catch (e) {
        console.error("Erreur de chargement:", e);
        toast.error("Erreur de chargement des projets");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [clientFilter, toast]);

  const clientByUid = useMemo(() => {
    const idx = {};
    for (const c of clients) idx[c.uid] = c;
    return idx;
  }, [clients]);

  const sortedClients = useMemo(() => {
    return [...clients].sort((a, b) =>
      labelFromClient(a).localeCompare(labelFromClient(b), "fr", { sensitivity: "base" })
    );
  }, [clients]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.clientUid) return toast.warning("Choisis un client");
    if (!form.titre.trim()) return toast.warning("Le titre est obligatoire");
    try {
      const created = await createProject({
        clientUid: form.clientUid,
        titre: form.titre.trim(),
        description: form.description.trim(),
        consultanteUid: null, // Si tu veux l'auto-assigner, tu peux mettre l'ID de la consultante ici
      });
      setProjects((prev) => [...prev, created]);
      setForm({ clientUid: "", titre: "", description: "" });
      setShowForm(false);
      toast.success("✅ Projet créé avec succès");
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors de la création du projet");
    }
  };

  const handlePatch = async (projId, patch) => {
    const safePatch = { ...patch };
    if (typeof safePatch.avancement !== "undefined") safePatch.avancement = clampPct(safePatch.avancement);
    if (safePatch.statutGlobal === "termine") safePatch.avancement = 100;

    setProjects((prev) => prev.map((p) => (p.id === projId ? { ...p, ...safePatch } : p)));

    try {
      const updated = await patchProject(projId, safePatch);
      if (updated) setProjects((prev) => prev.map((p) => (p.id === projId ? { ...p, ...updated } : p)));
      toast.success("Projet mis à jour");
    } catch (e) {
      console.error("PATCH /projects/:id", e);
      toast.error("Erreur lors de la mise à jour");
    }
  };

  return (
    <div className="page-shell min-h-screen pb-12 pt-8">
      <div className="max-w-[1400px] mx-auto px-6">
        <h1 className="page-title mb-8">📁 Mes Projets</h1>

        {/* Barre de filtres et actions */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="w-full md:w-72">
            <select
              className="app-input"
              value={clientFilter}
              onChange={(e) => setClientFilter(e.target.value)}
            >
              <option value="">Tous mes clients</option>
              {sortedClients.map((c) => (
                <option key={c.uid} value={c.uid}>
                  {labelFromClient(c)}
                </option>
              ))}
            </select>
          </div>
          
          <button
            onClick={() => setShowForm((s) => !s)}
            className={`app-btn ${showForm ? 'app-btn-ghost' : 'app-btn-primary'}`}
          >
            {showForm ? "Annuler" : "+ Créer un projet"}
          </button>
        </div>

        {/* Formulaire de création */}
        {showForm && (
          <form
            onSubmit={handleCreate}
            className="app-card p-6 mb-8 animate-fade-in border-l-4 border-l-brand grid grid-cols-1 md:grid-cols-3 gap-4"
          >
            <div>
              <label className="text-xs text-muted font-semibold uppercase mb-1 block">Client</label>
              <select
                className="app-input"
                value={form.clientUid}
                onChange={(e) => setForm({ ...form, clientUid: e.target.value })}
                required
              >
                <option value="">— Choisir un client —</option>
                {sortedClients.map((c) => (
                  <option key={c.uid} value={c.uid}>{labelFromClient(c)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted font-semibold uppercase mb-1 block">Titre du projet</label>
              <input
                type="text"
                placeholder="Ex: Demande de financement"
                value={form.titre}
                onChange={(e) => setForm({ ...form, titre: e.target.value })}
                className="app-input"
                required
              />
            </div>
            <div>
              <label className="text-xs text-muted font-semibold uppercase mb-1 block">Description</label>
              <input
                type="text"
                placeholder="Détails du dossier..."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="app-input"
              />
            </div>
            <div className="md:col-span-3 flex justify-end mt-2 pt-4 border-t border-border-soft">
              <button type="submit" className="app-btn app-btn-primary px-8">
                Enregistrer le projet
              </button>
            </div>
          </form>
        )}

        {/* Tableau des projets */}
        {loading ? (
          <div className="app-card p-12 text-center text-muted animate-pulse">Chargement de vos projets...</div>
        ) : (
          <div className="app-card p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-bg-surface border-b border-border-strong text-xs uppercase tracking-wider text-text-muted">
                  <tr>
                    <th className="px-6 py-4 font-semibold">Titre</th>
                    <th className="px-6 py-4 font-semibold">Client</th>
                    <th className="px-6 py-4 font-semibold">Avancement</th>
                    <th className="px-6 py-4 font-semibold">Statut</th>
                    <th className="px-6 py-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-soft">
                  {projects.map((p) => {
                    const client = clientByUid[p.clientUid];
                    const closed = (p.statutGlobal || "en_cours") === "termine";
                    const progress = clampPct(p.avancement ?? 0);

                    return (
                      <tr key={p.id} className="hover:bg-bg-muted/30 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-semibold text-text-primary">{p.titre}</div>
                          <div className="text-sm text-text-muted mt-1 max-w-xs truncate" title={p.description}>
                            {p.description || "Aucune description"}
                          </div>
                        </td>
                        
                        <td className="px-6 py-4 text-sm font-medium">
                          {labelFromClient(client) || p.clientUid}
                        </td>

                        {/* Progress */}
                        <td className="px-6 py-4">
                          <div className="w-48">
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-text-muted">Progression</span>
                              <span className="font-medium">{progress}%</span>
                            </div>
                            <div className="h-2 bg-bg-muted rounded-full overflow-hidden mb-2">
                              <div className={`h-full ${progressColor(progress)} transition-all duration-300`} style={{ width: `${progress}%` }} />
                            </div>
                            <input
                              type="range"
                              min="0"
                              max="100"
                              step="1"
                              value={progress}
                              disabled={closed}
                              onChange={(e) =>
                                setProjects((prev) =>
                                  prev.map((x) =>
                                    x.id === p.id ? { ...x, avancement: clampPct(e.target.value) } : x
                                  )
                                )
                              }
                              onMouseUp={(e) => !closed && handlePatch(p.id, { avancement: Number(e.currentTarget.value) })}
                              onTouchEnd={(e) => !closed && handlePatch(p.id, { avancement: Number(e.currentTarget.value) })}
                              className="w-full accent-brand cursor-pointer"
                              aria-label="Avancement"
                            />
                          </div>
                        </td>

                        {/* Statut */}
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-2 items-start">
                            <StatusChip value={p.statutGlobal || "en_cours"} />
                            <select
                              className="app-input h-8 py-0 text-sm w-32"
                              value={p.statutGlobal || "en_cours"}
                              onChange={(e) => {
                                const value = e.target.value;
                                const optimistic = { statutGlobal: value, ...(value === "termine" ? { avancement: 100 } : {}) };
                                setProjects((prev) => prev.map((x) => (x.id === p.id ? { ...x, ...optimistic } : x)));
                                handlePatch(p.id, optimistic);
                              }}
                            >
                              {STATUTS.map((s) => (
                                <option key={s.value} value={s.value}>{s.label}</option>
                              ))}
                            </select>
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="px-6 py-4 text-right">
                          <Link
                            to={`/consultante-dashboard/projets/${p.id}`}
                            className="app-btn app-btn-ghost text-sm py-1.5 px-4"
                          >
                            Ouvrir le dossier
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                  
                  {projects.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-text-muted">
                        Aucun projet trouvé.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}