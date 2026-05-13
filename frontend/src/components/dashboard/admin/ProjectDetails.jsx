import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom"; // Ajout de useNavigate
import axios from "axios";
import { patchProject } from "../../../services/projectService";
import { getClients } from "../../../services/adminService";
import { useToast } from "../../ui/Toast";
import WhatsAppButton from "../../WhatsAppButton";
import FilePreviewModal from "../../common/preview/FilePreviewModal";

// Firestore
import { collection, query, onSnapshot } from "firebase/firestore";
import { db } from "../../../firebase/firebase";

/* ===================== Constantes / API ===================== */
const STATUTS = [
  { value: "en_cours", label: "En cours" },
  { value: "bloque", label: "Bloqué" },
  { value: "termine", label: "Terminé" },
];
const API_URL = "http://localhost:8080/api/admin";
const API = "http://localhost:8080/api";
const authHeaders = () => ({
  headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
});

/* ===================== Helpers génériques ===================== */
const clampPct = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0;
};

const progressColor = (p) =>
  p >= 80 ? "bg-green-500" : p < 20 ? "bg-red-500" : "bg-amber-500";

const fmtDate = (v) => {
  if (!v) return "—";
  const d =
    typeof v?.toDate === "function"
      ? v.toDate()
      : typeof v === "number"
      ? new Date(v)
      : new Date(v);

  return d.toLocaleDateString("fr-FR");
};

function logAxiosError(err, label) {
  if (err?.response) console.error(`${label}:`, err.response.status, err.response.data);
  else if (err?.request) console.error(`${label}: no response`, err.message);
  else console.error(`${label}:`, err?.message || err);
}

function normalizeClient(raw) {
  const uid = raw?.uid || raw?.id || raw?.userId || "";
  const prenom = raw?.prenom || raw?.firstName || raw?.firstname || "";
  const nom = raw?.nom || raw?.lastName || raw?.lastname || "";
  const email = raw?.email || raw?.mail || "";
  const phone = raw?.whatsapp || raw?.phone || "";
  return { uid, prenom, nom, email, whatsapp: raw?.whatsapp, phone, _raw: raw };
}

function labelFromClient(c) {
  if (!c) return "—";
  const name = [c.prenom, c.nom].filter(Boolean).join(" ").trim();
  if (name && c.email) return `${name} (${c.email})`;
  return name || c.email || c.uid || "—";
}

async function fetchDocsApi(projectId) {
  try {
    const { data } = await axios.get(
      `${API}/projets/${projectId}/documents`,
      authHeaders()
    );
    return (Array.isArray(data) ? data : []).map((d) => ({
      id: d.id,
      fileName: d.name,
      contentType: d.contentType,
      statut: d.status,
      createdAt: d.createdAt,
      roleAtUpload: d.uploadedByRole,
    }));
  } catch (e) {
    console.error("GET /projets/:id/documents", e);
    return [];
  }
}

const statusMeta = (value) => {
  switch (value) {
    case "en_cours":
      return {
        label: "En cours",
        badgeClass: "status-badge status-progress",
        selectClass: "border-blue-500/30",
      };
    case "bloque":
      return {
        label: "Bloqué",
        badgeClass: "status-badge status-inactive",
        selectClass: "border-red-500/30",
      };
    case "termine":
      return {
        label: "Terminé",
        badgeClass: "status-badge status-completed",
        selectClass: "border-green-500/30",
      };
    default:
      return {
        label: "En cours",
        badgeClass: "status-badge status-progress",
        selectClass: "border-blue-500/30",
      };
  }
};

/* ===================== Badges / Lignes / Cartes ===================== */
const extFrom = (name = "") => (name.split(".").pop() || "").toLowerCase();

const TypeBadge = ({ d }) => {
  const ct = (d?.contentType || "").toLowerCase();
  const ext = extFrom(d?.fileName || d?.name || "");
  const t =
    ct.includes("pdf") || ext === "pdf"
      ? "PDF"
      : ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext) ||
        ct.startsWith("image/")
      ? "Image"
      : ["doc", "docx"].includes(ext)
      ? "DOCX"
      : ["xls", "xlsx", "csv"].includes(ext)
      ? ext === "csv"
        ? "CSV"
        : "XLSX"
      : ["json", "txt", "md", "log"].includes(ext) || ct.startsWith("text/")
      ? "Texte"
      : "Fichier";

  const colors = {
    PDF: "bg-red-500/15 text-red-400 border-red-500/30",
    Image: "bg-purple-500/15 text-purple-300 border-purple-500/30",
    DOCX: "bg-blue-500/15 text-blue-300 border-blue-500/30",
    XLSX: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    CSV: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    Texte: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    Fichier: "bg-gray-500/15 text-gray-300 border-gray-500/30",
  };

  const cls = colors[t] || colors.Fichier;

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded border text-[11px] leading-none ${cls}`}
    >
      {t}
    </span>
  );
};

function DocumentRow({ d, onPreview, onDownload, onDelete }) {
  return (
    <tr className="docs-table-row border-b border-white/10 dark:border-black/10 hover:bg-black/5 dark:hover:bg-white/5 transition">
      <td className="px-6 py-4 align-middle">
        <div className="flex items-center gap-3 min-w-0">
          <TypeBadge d={d} />
          <div
            className="truncate text-sm leading-6"
            title={d.fileName || d.name}
          >
            {d.fileName || d.name}
          </div>
        </div>
      </td>

      <td className="px-3 py-4 whitespace-nowrap text-sm text-secondary align-middle">
  {fmtDate(d.createdAt)}
</td>

      <td className="px-4 py-4 align-middle">
  <div className="flex items-center gap-2 whitespace-nowrap justify-start">
    <button
      onClick={onPreview}
      className="app-btn app-btn-ghost min-h-0 px-3 py-1.5 text-[11px] whitespace-nowrap"
      title="Prévisualiser"
    >
      Aperçu
    </button>

    <a
      href={onDownload}
      target="_blank"
      rel="noreferrer"
      className="app-btn app-btn-ghost min-h-0 px-3 py-1.5 text-[11px] whitespace-nowrap"
      title="Télécharger"
    >
      Téléch.
    </a>

    {onDelete && (
      <button
        onClick={onDelete}
        className="app-btn app-btn-danger min-h-0 px-3 py-1.5 text-[11px] whitespace-nowrap"
        title="Supprimer"
      >
        Suppr.
      </button>
    )}
  </div>
</td>
    </tr>
  );
}

function DocumentCard({
  title,
  description,
  docs,
  emptyText,
  uploadDisabled,
  fileState,
  onSubmit,
  submitting,
  pct,
  previewFactory,
  downloadHrefFactory,
  onDelete,
}) {
  const [file, setFile] = fileState;

  return (
    <div className="app-card docs-card h-full min-h-[420px] p-6 flex flex-col">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-md">
          <h3 className="text-2xl font-semibold leading-snug">{title}</h3>
          {description && <p className="mt-2 text-sm text-muted">{description}</p>}
          <div className="mt-4 text-sm opacity-80">
            Documents : <b>{docs.length}</b>
          </div>
        </div>

        <form
  onSubmit={onSubmit}
  className="flex flex-col gap-3 lg:min-w-[300px] lg:max-w-[320px]"
>
  {/* File picker */}
  <label className="flex items-center justify-center rounded-lg border border-dashed border-white/20 px-4 py-3 text-sm cursor-pointer hover:border-white/40 transition">
    📁 Choisir un fichier
    <input
      type="file"
      className="hidden"
      disabled={uploadDisabled}
      onChange={(e) => setFile(e.target.files?.[0] || null)}
    />
  </label>

  {/* Nom fichier */}
  <div className="text-xs text-muted truncate">
    {file ? `✔ ${file.name}` : "Aucun fichier sélectionné"}
  </div>

  {/* Progress bar */}
  {submitting && (
    <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
      <div
        className="h-2 bg-blue-500 transition-all"
        style={{ width: `${pct}%` }}
      />
    </div>
  )}

  {/* Bouton */}
  <button
    type="submit"
    disabled={!file || submitting || uploadDisabled}
    className={`rounded-md px-4 py-2 text-sm font-medium transition ${
      submitting || uploadDisabled
        ? "bg-gray-600 cursor-not-allowed"
        : "bg-blue-600 hover:bg-blue-700"
    }`}
  >
    {uploadDisabled
      ? "Upload désactivé"
      : submitting
      ? `Upload… ${pct}%`
      : "Uploader"}
  </button>
</form>
      </div>

      <div className="mt-5 rounded-lg border border-white/10 dark:border-black/10 overflow-hidden flex-1">
        <table className="w-full table-fixed text-sm">
          <thead className="bg-gray-800 text-white/90 border-b border-white/10">
            <tr>
              <th className="w-[43%] px-4 py-4 text-left text-xs font-semibold uppercase tracking-wide">
  Fichier
</th>
<th className="w-[13%] px-3 py-4 text-left text-xs font-semibold uppercase tracking-wide">
  Date
</th>
<th className="w-[44%] px-4 py-4 text-left text-xs font-semibold uppercase tracking-wide">
  Actions
</th>
            </tr>
          </thead>

          <tbody>
            {docs.map((d) => (
              <DocumentRow
                key={d.id}
                d={d}
                onPreview={() => previewFactory(d)}
                onDownload={downloadHrefFactory(d)}
                onDelete={onDelete ? () => onDelete(d) : null}
              />
            ))}

            {!docs.length && (
              <tr>
                <td colSpan={3} className="px-6 py-16 text-center">
                  <div className="flex flex-col items-center gap-3 animate-fade-in">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-xl backdrop-blur-sm">
                      📄
                    </div>
                    <p className="text-base font-medium text-secondary">{emptyText}</p>
                    <p className="text-xs text-muted">
                      Ajoutez un document pour démarrer cet espace.
                    </p>
                    <label className="app-btn app-btn-primary mt-2 cursor-pointer">
                      Ajouter un document
                      <input
                        type="file"
                        className="hidden"
                        disabled={uploadDisabled}
                        onChange={(e) => setFile(e.target.files?.[0] || null)}
                      />
                    </label>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ===================== Composant principal ===================== */
export default function ProjectDetails() {
  const toast = useToast();
  const { id } = useParams();
  const navigate = useNavigate(); // Hook pour redirection

  const [editing, setEditing] = useState(false);
const [editData, setEditData] = useState({
  titre: "",
  description: "",
});


  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState(null);
  const [clients, setClients] = useState([]);
  const [docs, setDocs] = useState([]);

  const [fileClient, setFileClient] = useState(null);
  const [uploadingClient, setUploadingClient] = useState(false);
  const [pctClient, setPctClient] = useState(0);

  const [fileConsult, setFileConsult] = useState(null);
  const [uploadingConsult, setUploadingConsult] = useState(false);
  const [pctConsult, setPctConsult] = useState(0);

  const [genericPreview, setGenericPreview] = useState(null);
  const token = localStorage.getItem("token") || "";

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const [cRes, pRes] = await Promise.all([
          getClients(),
          axios.get(`${API_URL}/projects`, authHeaders()),
        ]);

        if (!mounted) return;

        setClients((cRes || []).map(normalizeClient));
        const found = (pRes.data || []).find((x) => x.id === id);
        setProject(found || null);
      } catch (e) {
        logAxiosError(e, "GET /projects");
        toast.error("Erreur de chargement du projet");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [id, toast]);

  useEffect(() => {
  if (project) {
    setEditData({
      titre: project.titre || "",
      description: project.description || "",
    });
  }
}, [project]);

  useEffect(() => {
    if (!db || !id) return;
    let unsub;

    (async () => {
      try {
        const q = query(collection(db, "projects", id, "documents"));
        unsub = onSnapshot(
          q,
          (snap) => setDocs(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
          async () => setDocs(await fetchDocsApi(id))
        );
      } catch {
        setDocs(await fetchDocsApi(id));
      }
    })();

    return () => {
      try {
        unsub && unsub();
      } catch {}
    };
  }, [id]);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const rows = await fetchDocsApi(id);
      if (rows.length) setDocs((prev) => (prev && prev.length ? prev : rows));
    })();
  }, [id]);

  const client = useMemo(() => {
    if (!project) return null;
    return clients.find((c) => c.uid === project.clientUid) || null;
  }, [clients, project]);

  const closed = (project?.statutGlobal || "en_cours") === "termine";
  const progress = clampPct(project?.avancement ?? 0);
  const status = statusMeta(project?.statutGlobal || "en_cours");

  const docsClient = useMemo(
    () =>
      docs.filter(
        (d) =>
          (d.roleAtUpload || "").toLowerCase() === "client" ||
          (d.statut === "en_attente" && !d.roleAtUpload)
      ),
    [docs]
  );

  const docsConsultante = useMemo(
    () =>
      docs.filter(
        (d) =>
          (d.roleAtUpload || "").toLowerCase() === "consultante" ||
          (d.statut === "valide" && !d.roleAtUpload)
      ),
    [docs]
  );

  // SUPPRESSION DU PROJET ENTIER
  const handleDeleteProject = async () => {
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer ce projet et TOUS ses documents ?")) return;
    try {
      await axios.delete(`${API_URL}/projects/${id}`, authHeaders());
      toast.success("✅ Projet supprimé définitivement");
      navigate("/admin-dashboard/projects");
    } catch (err) {
      logAxiosError(err, "DELETE /projects");
      toast.error("Erreur lors de la suppression du projet");
    }
  };

  const handleUpdateProject = async (patch) => {
    if (!project) return;

    const safePatch = { ...patch };
    if (typeof safePatch.avancement !== "undefined") {
      safePatch.avancement = clampPct(safePatch.avancement);
    }
    if (safePatch.statutGlobal === "termine") safePatch.avancement = 100;

    setProject((prev) => ({ ...(prev || {}), ...safePatch }));

    try {
      const updated = await patchProject(project.id, safePatch);
      if (updated) setProject((prev) => ({ ...(prev || {}), ...updated }));
      toast.success("✅ Projet mis à jour");
    } catch (e) {
      logAxiosError(e, "PATCH /projects/:id");
      toast.error("Erreur lors de la mise à jour du projet");
    }
  };

  const uploadClient = async (e) => {
    e.preventDefault();
    if (closed || !fileClient) return;

    try {
      setUploadingClient(true);
      setPctClient(0);

      const form = new FormData();
      form.append("file", fileClient);

      await axios.post(`${API}/projets/${id}/documents`, form, {
        ...authHeaders(),
        headers: {
          ...authHeaders().headers,
          "Content-Type": "multipart/form-data",
        },
        onUploadProgress: (evt) => {
          if (evt.total) setPctClient(Math.round((evt.loaded * 100) / evt.total));
        },
      });

      setFileClient(null);
      setDocs(await fetchDocsApi(id));
      toast.success("✅ Document client uploadé");
    } catch (err) {
      const statusCode = err?.response?.status;
      const msg = err?.response?.data?.error;
      if (statusCode === 413) toast.error("Fichier trop volumineux (10 Mo max).");
      else if (statusCode === 400 && msg) toast.error(msg);
      else toast.error("Échec de l’upload");
    } finally {
      setUploadingClient(false);
      setPctClient(0);
    }
  };

  const uploadConsult = async (e) => {
    e.preventDefault();
    if (closed || !fileConsult) return;

    try {
      setUploadingConsult(true);
      setPctConsult(0);

      const form = new FormData();
      form.append("file", fileConsult);

      await axios.post(`${API}/projets/${id}/documents-traites`, form, {
        ...authHeaders(),
        headers: {
          ...authHeaders().headers,
          "Content-Type": "multipart/form-data",
        },
        onUploadProgress: (evt) => {
          if (evt.total) setPctConsult(Math.round((evt.loaded * 100) / evt.total));
        },
      });

      setFileConsult(null);
      setDocs(await fetchDocsApi(id));
      toast.success("✅ Document consultante uploadé");
    } catch (err) {
      const statusCode = err?.response?.status;
      const msg = err?.response?.data?.error;
      if (statusCode === 413) toast.error("Fichier trop volumineux (10 Mo max).");
      else if (statusCode === 400 && msg) toast.error(msg);
      else toast.error("Échec de l’upload");
    } finally {
      setUploadingConsult(false);
      setPctConsult(0);
    }
  };

  const handleDocDelete = async (docRow) => {
    if (!window.confirm(`Supprimer le document "${docRow.fileName || docRow.name}" ?`)) {
      return;
    }

    try {
      // ✅ APPEL CORRIGÉ : Endpoint cohérent avec ton DocumentController
      await axios.delete(`${API}/projets/${id}/documents/${docRow.id}`, authHeaders());
      setDocs((prev) => prev.filter((x) => x.id !== docRow.id));
      toast.success("✅ Document supprimé");
    } catch (err) {
      console.error(err);
      toast.error("Échec de la suppression");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 dark:bg-white text-white dark:text-black p-8">
        <div className="max-w-5xl mx-auto">Chargement…</div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-gray-900 dark:bg-white text-white dark:text-black p-8">
        <div className="max-w-5xl mx-auto">
          <div className="mb-4">
            <Link to="/admin-dashboard/projects" className="text-blue-400 hover:underline">
              ← Retour aux projets
            </Link>
          </div>
          <p>Projet introuvable.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="page-container py-8 min-h-screen project-details-shell">
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <Link
              to="/admin-dashboard/projects"
              className="text-sm font-medium text-blue-400 dark:text-blue-600 hover:underline"
            >
              ← Retour aux projets
            </Link>

            {/* ✅ NOUVEAU BOUTON DE SUPPRESSION */}
            <button 
              onClick={handleDeleteProject}
              className="app-btn app-btn-danger px-6 py-2 shadow-lg"
            >
              Supprimer le projet
            </button>
          </div>

          <section className="app-card project-hero p-6 md:p-8">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0 flex-1">
                <div className="mb-4 flex items-start justify-between gap-4">
  <div className="min-w-0 flex-1">
    <div className="flex items-center gap-3">
      {editing ? (
        <input
          value={editData.titre}
          onChange={(e) =>
            setEditData({ ...editData, titre: e.target.value })
          }
          className="app-input text-xl font-bold"
        />
      ) : (
        <h1 className="text-3xl font-bold">{project.titre}</h1>
      )}

      <span className={`${status.badgeClass} whitespace-nowrap`}>
  {status.label}
</span>
    </div>

    <div className="mt-3">
      {editing ? (
        <textarea
          value={editData.description}
          onChange={(e) =>
            setEditData({ ...editData, description: e.target.value })
          }
          className="app-input w-full"
          rows={3}
        />
      ) : (
        <p className="text-secondary">
          {project.description || "Aucune description fournie pour ce projet."}
        </p>
      )}
    </div>
  </div>

  <div className="flex shrink-0 items-center gap-2">
    {!editing ? (
      <button
        onClick={() => setEditing(true)}
        className="app-btn app-btn-ghost min-h-0 px-3 py-2 text-sm whitespace-nowrap"
      >
        Modifier
      </button>
    ) : (
      <>
        <button
          onClick={async () => {
            try {
              await handleUpdateProject({
                titre: editData.titre,
                description: editData.description,
              });
              setEditing(false);
            } catch {
              toast.error("Erreur lors de la mise à jour");
            }
          }}
          className="app-btn app-btn-primary min-h-0 px-3 py-2 text-sm whitespace-nowrap"
        >
          Enregistrer
        </button>

        <button
          onClick={() => {
            setEditing(false);
            setEditData({
              titre: project.titre,
              description: project.description,
            });
          }}
          className="app-btn app-btn-ghost min-h-0 px-3 py-2 text-sm whitespace-nowrap"
        >
          Annuler
        </button>
      </>
    )}
  </div>
</div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div className="app-card project-subcard p-4 hover:scale-[1.01]">
                    <p className="text-sm text-muted">Client</p>
                    <p className="mt-1 font-semibold">
                      {labelFromClient(client) || project.clientUid}
                    </p>
                  </div>

                  <div className="app-card project-subcard p-4 hover:scale-[1.01]">
                    <p className="text-sm text-muted">Créé le</p>
                    <p className="mt-1 font-semibold">{fmtDate(project.createdAt)}</p>
                  </div>

                  <div className="app-card project-subcard p-4 hover:scale-[1.01]">
                    <p className="text-sm text-muted">Canal rapide</p>
                    <div className="mt-2">
                      <WhatsAppButton
    phone={client?.whatsapp || client?.phone || ""}
    message={`Bonjour ${client?.prenom || ""}, je vous contacte concernant le projet "${project?.titre || ""}".`}
    label="WhatsApp"
  />
                    </div>
                  </div>
                </div>
              </div>

              <div className="w-full xl:max-w-[360px]">
                <div className="app-card project-subcard p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm text-muted">Avancement global</p>
                    <span className="text-lg font-bold">{progress}%</span>
                  </div>

                  <div className="mb-3 h-3 rounded-full bg-gray-700 dark:bg-gray-300 overflow-hidden">
                    <div
                      className={`h-3 rounded-full ${progressColor(progress)} transition-all duration-300`}
                      style={{
                        width: `${progress}%`,
                        boxShadow: "0 0 10px rgba(59,130,246,0.4)",
                      }}
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
                      setProject((prev) => ({
                        ...(prev || {}),
                        avancement: clampPct(e.target.value),
                      }))
                    }
                    onMouseUp={(e) =>
                      !closed &&
                      handleUpdateProject({
                        avancement: clampPct(e.currentTarget.value),
                      })
                    }
                    onTouchEnd={(e) =>
                      !closed &&
                      handleUpdateProject({
                        avancement: clampPct(e.currentTarget.value),
                      })
                    }
                    className="mb-3 w-full"
                    aria-label="Avancement"
                  />

                  <div className="mb-4 flex items-center justify-between text-xs">
                    <span className="text-muted">0%</span>
                    <span className="font-medium text-secondary">
                      Valeur actuelle : {progress}%
                    </span>
                    <span className="text-muted">100%</span>
                  </div>

                  <div className="mb-2 flex items-center justify-between">
                    <label className="block text-sm text-muted">Statut global</label>
                    <span className={`${status.badgeClass} whitespace-nowrap`}>
  {status.label}
</span>
                  </div>

                  <select
                    className={`app-input border ${status.selectClass}`}
                    value={project.statutGlobal || "en_cours"}
                    onChange={(e) => {
                      const v = e.target.value;
                      setProject((prev) => ({
                        ...(prev || {}),
                        statutGlobal: v,
                        ...(v === "termine" ? { avancement: 100 } : {}),
                      }));
                      handleUpdateProject({ statutGlobal: v });
                    }}
                  >
                    {STATUTS.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>

                  {closed && (
                    <p className="mt-3 text-xs text-muted">
                      Projet clôturé — modification désactivée.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </section>

          <section className="pt-2">
  <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
    📁 Documents du projet
  </h2>

  <div className="grid gap-6 xl:grid-cols-2 items-start">
              <DocumentCard
                title="Documents déposés par le client"
                description="Documents transmis par le client pour analyse"
                docs={docsClient}
                emptyText="Aucun document client."
                uploadDisabled={closed}
                fileState={[fileClient, setFileClient]}
                onSubmit={uploadClient}
                submitting={uploadingClient}
                pct={pctClient}
                previewFactory={(d) =>
                  setGenericPreview({
                    url: `${API}/projets/${id}/documents/${d.id}/preview`,
                    name: d.fileName || d.name || "document",
                    contentType: d.contentType || "",
                  })
                }
                downloadHrefFactory={(d) =>
                  `${API}/projets/${id}/documents/${d.id}/download`
                }
                onDelete={(d) => handleDocDelete(d)}
              />

              <DocumentCard
                title="Documents déposés par la consultante"
                description="Documents traités et renvoyés par la consultante"
                docs={docsConsultante}
                emptyText="Aucun document de la consultante."
                uploadDisabled={closed}
                fileState={[fileConsult, setFileConsult]}
                onSubmit={uploadConsult}
                submitting={uploadingConsult}
                pct={pctConsult}
                previewFactory={(d) =>
                  setGenericPreview({
                    url: `${API}/projets/${id}/documents/${d.id}/preview`,
                    name: d.fileName || d.name || "document",
                    contentType: d.contentType || "",
                  })
                }
                downloadHrefFactory={(d) =>
                  `${API}/projets/${id}/documents/${d.id}/download`
                }
                onDelete={(d) => handleDocDelete(d)}
              />
            </div>
          </section>
        </div>
      </div>

      {genericPreview && (
        <FilePreviewModal
          url={genericPreview.url}
          token={token}
          fileName={genericPreview.name}
          contentType={genericPreview.contentType}
          onClose={() => setGenericPreview(null)}
        />
      )}
    </>
  );
}