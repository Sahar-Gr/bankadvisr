// src/components/dashboard/consultante/ProjectDetailsConsultante.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { patchProject } from "../../../services/projectService";
import { getClients } from "../../../services/adminService";
import { useToast } from "../../ui/Toast";
import WhatsAppCTA from "../../common/WhatsAppCTA";
import FilePreviewModal from "../../common/preview/FilePreviewModal";
import ProjectChat from "../../common/ProjectChat";

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
  p >= 80 ? "bg-success" : p < 20 ? "bg-danger" : "bg-warning";

const fmtDate = (v) => {
  if (!v) return "—";
  const d = typeof v?.toDate === "function" ? v.toDate() : new Date(v);
  return d.toLocaleDateString("fr-FR");
};

function normalizeClient(raw) {
  const uid = raw?.uid || raw?.id || raw?.userId || "";
  const prenom = raw?.prenom || raw?.firstName || raw?.firstname || "";
  const nom = raw?.nom || raw?.lastName || raw?.lastname || "";
  const email = raw?.email || raw?.mail || "";
  const phone = raw?.whatsapp || raw?.numeroWhatsApp || raw?.phone || "";
  return { uid, prenom, nom, email, whatsapp: phone, phone, _raw: raw };
}

function labelFromClient(c) {
  if (!c) return "—";
  const name = [c.prenom, c.nom].filter(Boolean).join(" ").trim();
  if (name && c.email) return `${name} (${c.email})`;
  return name || c.email || c.uid || "—";
}

const statusMeta = (value) => {
  switch (value) {
    case "en_cours":
      return { label: "En cours", badgeClass: "status-badge status-progress", selectClass: "border-blue-500/30" };
    case "bloque":
      return { label: "Bloqué", badgeClass: "status-badge status-inactive", selectClass: "border-red-500/30" };
    case "termine":
      return { label: "Terminé", badgeClass: "status-badge status-completed", selectClass: "border-green-500/30" };
    default:
      return { label: "En cours", badgeClass: "status-badge status-progress", selectClass: "border-blue-500/30" };
  }
};

async function fetchDocsApi(projectId) {
  try {
    const { data } = await axios.get(`${API}/projets/${projectId}/documents`, authHeaders());
    return (Array.isArray(data) ? data : []).map((d) => ({
      id: d.id,
      fileName: d.name,
      contentType: d.contentType,
      createdAt: d.createdAt,
      roleAtUpload: d.uploadedByRole,
      statut: d.status
    }));
  } catch (e) {
    console.error("GET documents", e);
    return [];
  }
}

const canPreviewQuick = (d) => {
  const name = (d?.fileName || d?.name || "").toLowerCase();
  const ct = (d?.contentType || "").toLowerCase();
  const ext = (name.split(".").pop() || "").toLowerCase();
  return (
    ct.includes("pdf") ||
    ["pdf","png","jpg","jpeg","gif","webp","svg","csv","json","txt","docx","xlsx"].includes(ext) ||
    ct.startsWith("image/") || ct.startsWith("text/") ||
    ct === "application/json" || ct === "text/csv" ||
    ct === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    ct === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
};

/* ===================== Badges / Lignes / Cartes ===================== */
const TypeBadge = ({ d }) => {
  const ct = (d?.contentType || "").toLowerCase();
  const ext = (d?.fileName || d?.name || "").split(".").pop().toLowerCase();
  const t = ct.includes("pdf") || ext === "pdf" ? "PDF"
    : ["png", "jpg", "jpeg", "gif", "svg"].includes(ext) || ct.startsWith("image/") ? "Image"
    : ["doc", "docx"].includes(ext) ? "DOCX"
    : ["xls", "xlsx", "csv"].includes(ext) ? (ext === "csv" ? "CSV" : "XLSX")
    : ["json", "txt", "md"].includes(ext) || ct.startsWith("text/") ? "Texte" : "Fichier";

  const colors = {
    PDF: "bg-red-500/15 text-red-400 border-red-500/30",
    Image: "bg-purple-500/15 text-purple-300 border-purple-500/30",
    DOCX: "bg-blue-500/15 text-blue-300 border-blue-500/30",
    XLSX: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    CSV: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    Texte: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    Fichier: "bg-gray-500/15 text-gray-300 border-gray-500/30",
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded border text-[11px] leading-none ${colors[t] || colors.Fichier}`}>
      {t}
    </span>
  );
};

function DocumentRow({ d, onPreview, onDownload, onDelete }) {
  return (
    <tr className="border-b border-border-soft hover:bg-bg-muted/30 transition">
      <td className="px-6 py-4 align-middle">
        <div className="flex items-center gap-3 min-w-0">
          <TypeBadge d={d} />
          <div className="truncate text-sm font-medium text-text-primary" title={d.fileName || d.name}>
            {d.fileName || d.name}
          </div>
        </div>
      </td>
      <td className="px-3 py-4 whitespace-nowrap text-sm text-text-secondary align-middle">
        {fmtDate(d.createdAt)}
      </td>
      <td className="px-4 py-4 align-middle">
        <div className="flex items-center gap-2 whitespace-nowrap justify-start">
          {canPreviewQuick(d) && (
            <button onClick={onPreview} className="app-btn app-btn-ghost min-h-0 px-3 py-1.5 text-[11px]">
              Aperçu
            </button>
          )}
          <a href={onDownload} target="_blank" rel="noreferrer" className="app-btn app-btn-ghost min-h-0 px-3 py-1.5 text-[11px]">
            Téléch.
          </a>
          {onDelete && (
            <button onClick={onDelete} className="app-btn app-btn-danger min-h-0 px-3 py-1.5 text-[11px]">
              Suppr.
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

function DocumentCard({
  title, description, docs, emptyText, uploadDisabled, fileState, onSubmit, submitting, pct, previewFactory, downloadHrefFactory, onDelete, showUpload = true
}) {
  const [file, setFile] = fileState || [null, null];

  return (
    <div className="app-card docs-card h-full min-h-[420px] p-6 flex flex-col">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-md">
          <h3 className="text-xl font-semibold leading-snug text-text-primary">{title}</h3>
          {description && <p className="mt-2 text-sm text-text-muted">{description}</p>}
          <div className="mt-4 text-sm font-medium text-text-secondary">
            Documents : <span className="text-text-primary">{docs.length}</span>
          </div>
        </div>

        {showUpload && onSubmit && (
          <form onSubmit={onSubmit} className="flex flex-col gap-3 lg:min-w-[300px] lg:max-w-[320px]">
            <label className="flex items-center justify-center rounded-lg border border-dashed border-border-strong px-4 py-3 text-sm cursor-pointer hover:border-brand hover:text-brand transition">
              📁 Choisir un fichier
              <input type="file" className="hidden" disabled={uploadDisabled} onChange={(e) => setFile(e.target.files?.[0] || null)} />
            </label>
            <div className="text-xs text-text-muted truncate">
              {file ? `✔ ${file.name}` : "Aucun fichier sélectionné"}
            </div>
            {submitting && (
              <div className="w-full h-2 bg-bg-muted rounded-full overflow-hidden">
                <div className="h-2 bg-brand transition-all" style={{ width: `${pct}%` }} />
              </div>
            )}
            <button
              type="submit"
              disabled={!file || submitting || uploadDisabled}
              className={`app-btn ${submitting || uploadDisabled ? "app-btn-secondary opacity-50" : "app-btn-primary"} w-full`}
            >
              {uploadDisabled ? "Upload désactivé" : submitting ? `Envoi… ${pct}%` : "Uploader"}
            </button>
          </form>
        )}
      </div>

      <div className="mt-5 rounded-lg border border-border-soft overflow-hidden flex-1 bg-bg-surface">
        <table className="w-full table-fixed text-sm">
          <thead className="bg-bg-muted text-text-primary border-b border-border-strong">
            <tr>
              <th className="w-[43%] px-4 py-4 text-left text-xs font-semibold uppercase tracking-wide">Fichier</th>
              <th className="w-[15%] px-3 py-4 text-left text-xs font-semibold uppercase tracking-wide">Date</th>
              <th className="w-[42%] px-4 py-4 text-left text-xs font-semibold uppercase tracking-wide">Actions</th>
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
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand/10 border border-brand/20 text-brand text-xl">
                      📄
                    </div>
                    <p className="text-base font-medium text-text-secondary">{emptyText}</p>
                    <p className="text-xs text-text-muted">Cet espace est vide pour le moment.</p>
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

/* ===================== Composant Principal ===================== */
export default function ProjectDetailsConsultante() {
  const toast = useToast();
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState(null);
  const [clients, setClients] = useState([]);
  const [docs, setDocs] = useState([]);

  const [fileConsult, setFileConsult] = useState(null);
  const [uploadingConsult, setUploadingConsult] = useState(false);
  const [pctConsult, setPctConsult] = useState(0);

  const [genericPreview, setGenericPreview] = useState(null);
  const subRef = useRef(null);
  const token = localStorage.getItem("token") || "";

  const currentUser = useMemo(() => ({
    uid: localStorage.getItem("uid"),
    name: "Consultante",
    role: "consultante"
  }), []);

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
        console.error("GET /projects:", e);
        toast.error("Erreur de chargement du projet");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [id, toast]);

  useEffect(() => {
    if (!db || !id) return;
    const q = query(collection(db, "projects", id, "documents"));
    const unsub = onSnapshot(
      q,
      (snap) => setDocs(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      async () => setDocs(await fetchDocsApi(id))
    );
    subRef.current = unsub;
    return () => {
      try { subRef.current && subRef.current(); } catch {}
      subRef.current = null;
    };
  }, [id]);

  const client = useMemo(() => {
    if (!project) return null;
    return clients.find((c) => c.uid === project.clientUid) || null;
  }, [clients, project]);

  const closed = (project?.statutGlobal || "en_cours") === "termine";
  const progress = clampPct(project?.avancement ?? 0);
  const statusInfo = statusMeta(project?.statutGlobal || "en_cours");

  // SUPPRESSION DU PROJET
  const handleDeleteProject = async () => {
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer ce projet et TOUS ses documents ?")) return;
    try {
      await axios.delete(`${API_URL}/projects/${id}`, authHeaders());
      toast.success("✅ Projet supprimé");
      navigate("/consultante-dashboard/projets");
    } catch (err) {
      toast.error("Erreur lors de la suppression du projet");
    }
  };

  const handleUpdateProject = async (patch) => {
    if (!project) return;
    const safePatch = { ...patch };
    if (typeof safePatch.avancement !== "undefined") safePatch.avancement = clampPct(safePatch.avancement);
    if (safePatch.statutGlobal === "termine") safePatch.avancement = 100;

    setProject((prev) => ({ ...(prev || {}), ...safePatch }));
    try {
      const updated = await patchProject(project.id, safePatch);
      if (updated) setProject((prev) => ({ ...(prev || {}), ...updated }));
      toast.success("✅ Projet mis à jour");
    } catch {
      toast.error("Erreur lors de la mise à jour");
    }
  };

  const uploadConsult = async (e) => {
    e.preventDefault();
    if (closed || !fileConsult) return toast.error("Choisis un fichier !");
    try {
      setUploadingConsult(true);
      setPctConsult(0);
      const form = new FormData();
      form.append("file", fileConsult);
      await axios.post(`${API}/projets/${id}/documents-traites`, form, {
        ...authHeaders(),
        onUploadProgress: (evt) => {
          if (evt.total) setPctConsult(Math.round((evt.loaded * 100) / evt.total));
        },
      });
      setFileConsult(null);
      setDocs(await fetchDocsApi(id));
      toast.success("✅ Document déposé");
    } catch (err) {
      toast.error("Échec de l’upload");
    } finally {
      setUploadingConsult(false);
    }
  };

  const handleDocDelete = async (docRow) => {
    if (!window.confirm(`Supprimer le document "${docRow.fileName || docRow.name}" ?`)) return;
    try {
      // ✅ APPEL CORRIGÉ
      await axios.delete(`${API}/projets/${id}/documents/${docRow.id}`, authHeaders());
      setDocs((prev) => prev.filter((x) => x.id !== docRow.id));
      toast.success("✅ Document supprimé");
    } catch {
      toast.error("Échec de la suppression");
    }
  };

  const markDone = async () => {
    await handleUpdateProject({ statutGlobal: "termine", avancement: 100 });
  };

  const byDateDesc = (a, b) => (b.createdAt || 0) - (a.createdAt || 0);
  const docsClient = docs.filter((d) => (d.roleAtUpload || "").toLowerCase() === "client" || d.statut === "en_attente").sort(byDateDesc);
  const docsConsultante = docs.filter((d) => (d.roleAtUpload || "").toLowerCase() === "consultante" || d.statut === "valide").sort(byDateDesc);

  const clientPhone = client?.whatsapp || client?.numeroWhatsApp || client?.phone || "";
  const waTextConsultante = `Bonjour ${client?.prenom || ""}, c'est la consultante BankAdvisr concernant le projet "${project?.titre || ""}".`;

  if (loading) return <div className="page-shell min-h-screen p-8 text-center text-muted">Chargement du projet...</div>;
  if (!project) return <div className="page-shell min-h-screen p-8 text-center"><Link to="/consultante-dashboard/projets" className="text-brand hover:underline">← Retour</Link><p className="mt-4">Projet introuvable.</p></div>;

  return (
    <div className="page-shell min-h-screen pb-12 pt-8">
      <div className="max-w-[1400px] mx-auto px-6 space-y-6">
        <div className="flex justify-between items-center">
          <Link to="/consultante-dashboard/projets" className="text-sm font-medium text-text-secondary hover:text-text-primary hover:underline transition-colors">
            ← Retour aux projets
          </Link>

          {/* ✅ BOUTON SUPPRIMER PROJET */}
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
                  <div className="flex flex-wrap items-center gap-3">
                    <h1 className="text-3xl font-bold text-text-primary">{project.titre}</h1>
                    <span className={`${statusInfo.badgeClass} whitespace-nowrap`}>{statusInfo.label}</span>
                  </div>
                  <p className="mt-3 text-text-secondary text-base">
                    {project.description || "Aucune description fournie pour ce projet."}
                  </p>
                </div>
                
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    onClick={markDone}
                    disabled={closed}
                    className={`app-btn ${closed ? "app-btn-secondary opacity-60" : "app-btn-success"}`}
                  >
                    {closed ? "Clôturé" : "Marquer terminé"}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3 mt-6">
                <div className="app-card project-subcard p-4 hover:scale-[1.01] transition-transform">
                  <p className="text-xs font-semibold uppercase text-text-muted">Client</p>
                  <p className="mt-1 font-semibold text-text-primary">{labelFromClient(client) || project.clientUid}</p>
                </div>
                <div className="app-card project-subcard p-4 hover:scale-[1.01] transition-transform">
                  <p className="text-xs font-semibold uppercase text-text-muted">Créé le</p>
                  <p className="mt-1 font-semibold text-text-primary">{fmtDate(project.createdAt)}</p>
                </div>
                <div className="app-card project-subcard p-4 hover:scale-[1.01] transition-transform">
                  <p className="text-xs font-semibold uppercase text-text-muted">Contact rapide</p>
                  <div className="mt-2">
                    <WhatsAppCTA phone={clientPhone} text={waTextConsultante} />
                  </div>
                </div>
              </div>
            </div>

            <div className="w-full xl:max-w-[360px]">
              <div className="app-card project-subcard p-5">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-semibold text-text-secondary">Avancement global</p>
                  <span className="text-lg font-bold text-text-primary">{progress}%</span>
                </div>

                <div className="mb-3 h-3 rounded-full bg-bg-muted overflow-hidden">
                  <div
                    className={`h-full ${progressColor(progress)} transition-all duration-300`}
                    style={{ width: `${progress}%`, boxShadow: "0 0 10px rgba(59,130,246,0.3)" }}
                  />
                </div>

                <input
                  type="range" min="0" max="100" step="1"
                  value={progress}
                  disabled={closed}
                  onChange={(e) => setProject((prev) => ({ ...prev, avancement: clampPct(e.target.value) }))}
                  onMouseUp={(e) => !closed && handleUpdateProject({ avancement: clampPct(e.currentTarget.value) })}
                  className="mb-3 w-full accent-brand cursor-pointer"
                />

                <div className="mb-2 mt-6">
                  <label className="block text-sm font-semibold text-text-secondary mb-2">Modifier le statut</label>
                  <select
                    className={`app-input border ${statusInfo.selectClass}`}
                    value={project.statutGlobal || "en_cours"}
                    onChange={(e) => {
                      const v = e.target.value;
                      handleUpdateProject({ statutGlobal: v });
                    }}
                  >
                    {STATUTS.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="pt-4">
          <div className="mb-6 flex items-center gap-3">
            <h2 className="text-2xl font-bold text-text-primary">📁 Documents du projet</h2>
          </div>

          <div className="grid gap-6 xl:grid-cols-2 items-start">
            <DocumentCard
              title="Documents déposés par le client"
              description="Fichiers transmis par le client pour analyse."
              docs={docsClient}
              emptyText="Aucun document fourni par le client."
              showUpload={false}
              previewFactory={(d) => setGenericPreview({ url: `${API}/projets/${id}/documents/${d.id}/preview`, name: d.fileName || d.name || "document", contentType: d.contentType || "" })}
              downloadHrefFactory={(d) => `${API}/projets/${id}/documents/${d.id}/download`}
            />

            <DocumentCard
              title="Documents déposés par la consultante"
              description="Fichiers traités, comptes-rendus et livrables."
              docs={docsConsultante}
              emptyText="Vous n'avez déposé aucun document."
              uploadDisabled={closed}
              showUpload={true}
              fileState={[fileConsult, setFileConsult]}
              onSubmit={uploadConsult}
              submitting={uploadingConsult}
              pct={pctConsult}
              previewFactory={(d) => setGenericPreview({ url: `${API}/projets/${id}/documents/${d.id}/preview`, name: d.fileName || d.name || "document", contentType: d.contentType || "" })}
              downloadHrefFactory={(d) => `${API}/projets/${id}/documents/${d.id}/download`}
              onDelete={(d) => handleDocDelete(d)}
            />
          </div>
        </section>

        <section className="pt-4 max-w-4xl mx-auto">
           <ProjectChat projectId={id} currentUser={currentUser} />
        </section>
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
    </div>
  );
}