// src/components/dashboard/client/ProjectListClient.jsx
import React, { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import ClientTopBar from "./ClientTopBar";
import ThemeToggle from "../../ThemeToggle";
import { FolderKanban, ChevronRight } from "lucide-react";

const API = "http://localhost:8080/api";
const auth = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } });
const getPid = (p) => p?.id || p?.projectId || p?.uid;

export default function ProjectListClient() {
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await axios.get(`${API}/client/projects`, auth());
        setProjects(Array.isArray(data) ? data : []);
      } catch {
        setProjects([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="page-shell min-h-screen pb-12">
      <ClientTopBar />
      <div className="max-w-5xl mx-auto px-6 pt-10 animate-fade-in">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="page-title text-2xl flex items-center gap-3">
              <FolderKanban className="text-brand h-6 w-6" /> Mes Projets
            </h1>
            <p className="text-text-secondary mt-1">Suivez l'état d'avancement de vos dossiers bancaires.</p>
          </div>
        </div>

        {loading ? (
          <div className="app-card p-12 text-center animate-pulse text-muted">Chargement de vos dossiers...</div>
        ) : projects.length === 0 ? (
          <div className="app-card p-12 text-center text-text-muted italic">Vous n'avez aucun projet en cours.</div>
        ) : (
          <div className="grid gap-4">
            {projects.map((p) => (
              <Link 
                key={getPid(p)} 
                to={`/client-dashboard/projets/${getPid(p)}`}
                className="app-card p-6 flex items-center justify-between group hover:border-brand/50 transition-all"
              >
                <div className="min-w-0 flex-1">
                  <h3 className="text-lg font-bold group-hover:text-brand transition-colors">{p.titre || "Projet sans titre"}</h3>
                  <p className="text-text-muted text-sm truncate pr-8">{p.description || "Pas de description"}</p>
                </div>
                <div className="flex items-center gap-4">
                   <div className="hidden sm:block text-right pr-4 border-r border-border-soft">
                      <div className="text-xs text-text-muted uppercase font-bold">Avancement</div>
                      <div className="text-brand font-bold">{p.avancement || 0}%</div>
                   </div>
                   <ChevronRight className="h-5 w-5 text-text-muted group-hover:text-brand group-hover:translate-x-1 transition-all" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}