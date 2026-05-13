// src/components/dashboard/client/ProjectDetailsClient.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import axios from "axios";
import { collection, query, onSnapshot } from "firebase/firestore";
import { db } from "../../../firebase/firebase";
import ClientTopBar from "./ClientTopBar";
import { useToast } from "../../ui/Toast";
import WhatsAppCTA from "../../common/WhatsAppCTA";
import FilePreviewModal from "../../common/preview/FilePreviewModal";
import ThemeToggle from "../../ThemeToggle";
import ProjectChat from "../../common/ProjectChat"; // Import bien présent

const API = "http://localhost:8080/api";
const auth = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } });

const clampPct = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0;
};
const progressColor = (p) => (p >= 80 ? "bg-success" : p < 20 ? "bg-danger" : "bg-warning");

const StatusChip = ({ value }) => {
  const map = { 
    en_cours: "status-progress", 
    bloque: "status-inactive", 
    termine: "status-active" 
  };
  const cls = map[value] || "bg-gray-500 text-white";
  const label = value === "en_cours" ? "En cours" : value === "bloque" ? "Bloqué" : value === "termine" ? "Terminé" : value;
  return <span className={`status-badge ${cls}`}>{label}</span>;
};

export default function ProjectDetailsClient() {
  const { id } = useParams();
  const toast = useToast();
  const [project, setProject] = useState(null);
  const [docs, setDocs] = useState([]);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [pct, setPct] = useState(0);
  const [loading, setLoading] = useState(true);
  const [genericPreview, setGenericPreview] = useState(null);
  const unsubRef = useRef(null);

  // --- NOUVEAU : Définition de currentUser ici pour avoir accès aux infos ---
  const currentUser = {
    uid: localStorage.getItem("uid") || "client_id",
    name: localStorage.getItem("client_name") || "Client", 
    role: "client"
  };

  useEffect(() => {
    (async () => {
      try {
        const { data } = await axios.get(`${API}/client/projects`, auth());
        setProject(data.find((p) => p.id === id) || null);
      } catch { toast.error("Erreur de chargement"); }
      finally { setLoading(false); }
    })();
  }, [id, toast]);

  useEffect(() => {
    if (!db || !id) return;
    const q = query(collection(db, "projects", id, "documents"));
    const unsub = onSnapshot(q, (snap) => setDocs(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
    unsubRef.current = unsub;
    return () => unsubRef.current?.();
  }, [id]);

  const docsTraites = useMemo(() => docs.filter((d) => d.statut === "valide" || d.roleAtUpload === "consultante"), [docs]);
  const progress = clampPct(project?.avancement ?? 0);
  const closed = project?.statutGlobal === "termine";

  const upload = async (e) => {
    e.preventDefault();
    if (closed || !file) return;
    try {
      setUploading(true);
      const form = new FormData();
      form.append("file", file);
      await axios.post(`${API}/projets/${id}/documents`, form, {
        ...auth(),
        onUploadProgress: (evt) => setPct(Math.round((evt.loaded * 100) / evt.total)),
      });
      setFile(null);
      toast.success("Fichier envoyé");
    } catch { toast.error("Échec upload"); }
    finally { setUploading(false); setPct(0); }
  };

  if (loading) return <div className="page-shell min-h-screen p-8 text-center">Chargement...</div>;

  return (
    <div className="page-shell min-h-screen pb-12">
      <ClientTopBar />
      <div className="max-w-6xl mx-auto px-6 pt-10 animate-fade-in space-y-6">
        <Link to="/client-dashboard/projets" className="text-sm text-text-secondary hover:text-brand flex items-center gap-2 transition-colors">
          ← Retour à la liste
        </Link>

        <section className="app-card p-8 border-l-4 border-brand">
          <div className="flex flex-col md:flex-row justify-between gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold text-text-primary">{project?.titre}</h1>
                <StatusChip value={project?.statutGlobal} />
              </div>
              <p className="text-text-secondary text-lg">{project?.description || "—"}</p>
            </div>
            
            <div className="w-full md:w-72 bg-bg-muted/20 p-5 rounded-2xl border border-border-soft">
              <div className="flex justify-between mb-2">
                <span className="text-sm font-bold text-text-secondary">Progression</span>
                <span className="text-brand font-bold">{progress}%</span>
              </div>
              <div className="h-3 bg-bg-muted rounded-full overflow-hidden">
                <div className={`h-full ${progressColor(progress)} transition-all duration-1000`} style={{ width: `${progress}%` }} />
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="app-card p-6">
            <h3 className="text-xl font-bold mb-6 text-text-primary flex items-center gap-2">📤 Déposer un document</h3>
            {!closed ? (
              <form onSubmit={upload} className="space-y-4">
                <label className="flex items-center justify-center rounded-xl border-2 border-dashed border-border-strong p-8 cursor-pointer hover:border-brand transition-colors">
                  <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} className="hidden" />
                  <span className="text-text-muted">{file ? file.name : "Cliquez pour choisir un fichier"}</span>
                </label>
                <button disabled={!file || uploading} className="app-btn app-btn-primary w-full py-3">
                  {uploading ? `Envoi en cours (${pct}%)` : "Envoyer le document"}
                </button>
              </form>
            ) : <p className="text-danger font-bold text-center p-4 bg-danger/10 rounded-xl">Projet clôturé.</p>}
          </div>

          <div className="app-card p-6">
            <h3 className="text-xl font-bold mb-6 text-text-primary">📄 Documents traités</h3>
            <div className="space-y-3">
              {docsTraites.map(d => (
                <div key={d.id} className="p-4 rounded-xl bg-bg-muted/20 border border-border-soft flex justify-between items-center">
                  <span className="font-medium text-text-primary truncate pr-4">{d.fileName || d.name}</span>
                  <a href={`${API}/projets/${id}/documents/${d.id}/download`} target="_blank" rel="noreferrer" className="app-btn app-btn-ghost text-xs py-1 px-3">Télécharger</a>
                </div>
              ))}
              {docsTraites.length === 0 && <p className="text-center text-text-muted py-8 italic">Aucun document validé pour l'instant.</p>}
            </div>
          </div>
        </div>

        {/* --- LE CHAT EST ICI (Espace de discussion) --- */}
        <div className="mt-10">
          <ProjectChat projectId={id} currentUser={currentUser} />
        </div>

      </div>

      
      {genericPreview && (
         <FilePreviewModal url={genericPreview.url} token={localStorage.getItem("token")} fileName={genericPreview.name} contentType={genericPreview.contentType} onClose={() => setGenericPreview(null)} />
      )}
    </div>
  );
}