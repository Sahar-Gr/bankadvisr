import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getProjects, createProject, patchProject } from "../../../services/projectService";
import { getClients } from "../../../services/adminService";
import ThemeToggle from "../../ThemeToggle";
import { useToast } from "../../ui/Toast";

function logAxiosError(err, label) {
  if (err?.response) {
    console.error(`${label} – status:`, err.response.status, "data:", err.response.data);
  } else if (err?.request) {
    console.error(`${label} – no response`, err.message);
  } else {
    console.error(`${label} – error`, err?.message || err);
  }
}

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
  if (p >= 80) return "bg-green-500";
  if (p < 20) return "bg-red-500";
  return "bg-amber-500";
};

const StatusChip = ({ value }) => {
  const map = {
    en_cours: "bg-blue-600 text-white",
    bloque: "bg-red-600 text-white",
    termine: "bg-green-600 text-white",
  };

  const label =
    value === "en_cours"
      ? "En cours"
      : value === "bloque"
      ? "Bloqué"
      : value === "termine"
      ? "Terminé"
      : value;

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-medium leading-none whitespace-nowrap ${
        map[value] || "bg-gray-500 text-white"
      }`}
    >
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

const BAD_TITLE_PATTERNS = [
  /^projet\s*\d*$/i,
  /^projet\s*auto/i,
  /^test$/i,
  /^aaa+$/i,
  /^azerty$/i,
  /^qwerty$/i,
];

function isWeakProjectTitle(value) {
  const v = (value || "").trim();
  if (v.length < 8) return true;
  return BAD_TITLE_PATTERNS.some((pattern) => pattern.test(v));
}

function isWeakProjectDescription(value) {
  const v = (value || "").trim();
  return v.length < 20;
}

export default function ProjectList() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState([]);
  const [projects, setProjects] = useState([]);
  const [clientFilter, setClientFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    clientUid: "",
    titre: "",
    description: "",
  });

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const [c, p] = await Promise.all([
          getClients(),
          getProjects(clientFilter || undefined),
        ]);

        if (!mounted) return;
        setClients((c || []).map(normalizeClient));
        setProjects(p || []);
      } catch (e) {
        console.error("Erreur de chargement:", e);
        toast.error("Erreur de chargement des projets.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [clientFilter, toast]);

  const clientByUid = useMemo(() => {
    const idx = {};
    for (const c of clients) idx[c.uid] = c;
    return idx;
  }, [clients]);

  const sortedClients = useMemo(
    () =>
      [...clients].sort((a, b) =>
        labelFromClient(a).localeCompare(labelFromClient(b), "fr", {
          sensitivity: "base",
        })
      ),
    [clients]
  );

  const handleCreate = async (e) => {
    e.preventDefault();

    if (!form.clientUid) {
      toast.error("Choisis un client.");
      return;
    }

    if (!form.titre.trim()) {
      toast.error("Le titre est obligatoire.");
      return;
    }

    if (isWeakProjectTitle(form.titre)) {
      toast.error("Utilise un titre plus précis et professionnel.");
      return;
    }

    if (isWeakProjectDescription(form.description)) {
      toast.error("La description doit être plus claire et plus détaillée.");
      return;
    }

    try {
      const created = await createProject({
        clientUid: form.clientUid,
        titre: form.titre.trim(),
        description: form.description.trim(),
        consultanteUid: null,
      });

      setProjects((prev) => [...prev, created]);
      setForm({ clientUid: "", titre: "", description: "" });
      setShowForm(false);
      toast.success("Projet créé.");
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors de la création du projet.");
    }
  };

  const handlePatch = async (projId, patch) => {
    const safePatch = { ...patch };

    if (typeof safePatch.avancement !== "undefined") {
      safePatch.avancement = clampPct(safePatch.avancement);
    }

    if (safePatch.statutGlobal === "termine") {
      safePatch.avancement = 100;
    }

    setProjects((prev) =>
      prev.map((p) => (p.id === projId ? { ...p, ...safePatch } : p))
    );

    try {
      const updated = await patchProject(projId, safePatch);

      if (updated) {
        setProjects((prev) =>
          prev.map((p) => (p.id === projId ? { ...p, ...updated } : p))
        );
      }

      toast.success("Projet mis à jour.");
    } catch (e) {
      logAxiosError(e, "PATCH /projects/:id");
      toast.error("Erreur lors de la mise à jour du projet.");
    }
  };

  return (
    <>
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="page-container py-8">
        <div className="mx-auto max-w-[1350px] px-4">
          <h1 className="mb-6 text-center text-3xl font-bold text-yellow-500">
            📁 Projets
          </h1>

          <div className="mb-6 flex items-center gap-3">
            <select
              className="app-input w-72"
              value={clientFilter}
              onChange={(e) => setClientFilter(e.target.value)}
            >
              <option value="">Tous les clients</option>
              {sortedClients.map((c) => (
                <option key={c.uid} value={c.uid}>
                  {labelFromClient(c)}
                </option>
              ))}
            </select>

            <button
              onClick={() => setShowForm((s) => !s)}
              className="app-btn app-btn-primary ml-auto"
            >
              {showForm ? "Annuler" : "Créer un projet"}
            </button>
          </div>

          {showForm && (
            <form
              onSubmit={handleCreate}
              className="app-card mb-6 grid grid-cols-1 gap-3 p-5 md:grid-cols-3"
            >
              <select
                className="app-input"
                value={form.clientUid}
                onChange={(e) =>
                  setForm({ ...form, clientUid: e.target.value })
                }
                required
              >
                <option value="">— Choisir un client —</option>
                {sortedClients.map((c) => (
                  <option key={c.uid} value={c.uid}>
                    {labelFromClient(c)}
                  </option>
                ))}
              </select>

              <input
                type="text"
                placeholder="Ex : Étude de rentabilité — cabinet médical"
                value={form.titre}
                onChange={(e) => setForm({ ...form, titre: e.target.value })}
                className="app-input"
                required
              />

              <input
                type="text"
                placeholder="Ex : Analyse financière préalable à une demande de financement bancaire."
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                className="app-input"
              />

              <button
                type="submit"
                className="app-btn app-btn-primary md:col-span-3"
              >
                Créer
              </button>
            </form>
          )}

          {loading ? (
            <p className="text-center">Chargement...</p>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-white/10 dark:border-black/10 bg-[var(--card-bg)] shadow-lg">
              <table className="min-w-full table-fixed text-[var(--text-primary)]">
                <thead>
                  <tr className="bg-[var(--bg-muted)] text-left text-xs uppercase tracking-wide text-[var(--text-primary)]">
                    <th className="w-[28%] px-6 py-3">Titre</th>
                    <th className="w-[24%] px-6 py-3">Client</th>
                    <th className="w-[20%] px-6 py-3">Avancement</th>
                    <th className="w-[18%] px-6 py-3">Statut</th>
                    <th className="w-[10%] px-6 py-3">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {projects.map((p) => {
                    const client = clientByUid[p.clientUid];
                    const closed =
                      (p.statutGlobal || "en_cours") === "termine";
                    const progress = clampPct(p.avancement ?? 0);

                    return (
                      <tr
                        key={p.id}
                        className="border-b border-white/10 hover:bg-white/[0.03]"
                      >
                        <td className="px-6 py-4 font-medium">
                          <span className="line-clamp-2">{p.titre}</span>
                        </td>

                        <td className="px-6 py-4 text-sm">
                          <span className="line-clamp-2">
                            {labelFromClient(client) || p.clientUid}
                          </span>
                        </td>

                        <td className="px-6 py-4">
                          <div className="w-full max-w-[180px]">
                            <div className="mb-2 h-2 rounded bg-gray-600">
                              <div
                                className={`h-2 rounded ${progressColor(progress)}`}
                                style={{ width: `${progress}%` }}
                              />
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
                                    x.id === p.id
                                      ? {
                                          ...x,
                                          avancement: clampPct(e.target.value),
                                        }
                                      : x
                                  )
                                )
                              }
                              onMouseUp={(e) =>
                                !closed &&
                                handlePatch(p.id, {
                                  avancement: Number(e.currentTarget.value),
                                })
                              }
                              onTouchEnd={(e) =>
                                !closed &&
                                handlePatch(p.id, {
                                  avancement: Number(e.currentTarget.value),
                                })
                              }
                              className="w-full"
                              aria-label="Avancement"
                            />
                          </div>
                        </td>

                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 whitespace-nowrap">
                            <StatusChip value={p.statutGlobal || "en_cours"} />

                            <select
                              className="app-input min-w-[120px]"
                              value={p.statutGlobal || "en_cours"}
                              onChange={(e) => {
                                const value = e.target.value;
                                const optimistic = {
                                  statutGlobal: value,
                                  ...(value === "termine"
                                    ? { avancement: 100 }
                                    : {}),
                                };

                                setProjects((prev) =>
                                  prev.map((x) =>
                                    x.id === p.id
                                      ? { ...x, ...optimistic }
                                      : x
                                  )
                                );

                                handlePatch(p.id, optimistic);
                              }}
                            >
                              {STATUTS.map((s) => (
                                <option key={s.value} value={s.value}>
                                  {s.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </td>

                        <td className="px-6 py-4">
                          <Link
                            to={`/admin-dashboard/projects/${p.id}`}
                            className="app-btn app-btn-primary min-h-0 whitespace-nowrap px-3 py-2 text-xs"
                          >
                            Détails
                          </Link>
                        </td>
                      </tr>
                    );
                  })}

                  {projects.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-6 py-6 text-center text-gray-400"
                      >
                        Aucun projet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}