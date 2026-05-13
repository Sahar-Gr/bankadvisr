// src/components/dashboard/client/ClientDashboard.jsx
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import ClientTopBar from "./ClientTopBar";
import axios from "axios";
import { format } from "date-fns";
import { FolderKanban, CalendarClock } from "lucide-react";

import { doc, getDoc } from "firebase/firestore";
import { db } from "../../../firebase/firebase";

const API = "http://localhost:8080/api";
const authHeader = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } });

const ymd = (d) => format(d, "yyyy-MM-dd");
const nowIso = () => {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${ymd(d)}T${hh}:${mm}:00`;
};

function decodeJwtPayload(token) {
  try {
    const p = token.split(".")[1];
    const json = atob(p.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(decodeURIComponent(escape(json)));
  } catch { return {}; }
}
function getUidFromTokenPayload(pl) {
  return pl.sub || pl.uid || pl.userId || pl.user_id || "";
}

export default function ClientDashboard() {
  const [upcoming, setUpcoming] = useState([]);
  const [past, setPast] = useState([]);
  const [loading, setLoading] = useState(false);
  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
    (async () => {
      const token = localStorage.getItem("token") || "";
      const uid = getUidFromTokenPayload(decodeJwtPayload(token));
      if (!uid) return;

      const cached = localStorage.getItem(`client_display_name:${uid}`);
      if (cached) {
        setDisplayName(cached);
        return;
      }

      try {
        const snap = await getDoc(doc(db, "users", uid));
        if (snap.exists()) {
          const u = snap.data() || {};
          const name = `${u.prenom || ""} ${u.nom || ""}`.trim() || u.nom || u.email || uid;
          setDisplayName(name);
          localStorage.setItem(`client_display_name:${uid}`, name);
          return;
        }
      } catch {}

      try {
        const r = await axios.get(`${API}/client/profile`, authHeader());
        const name = `${r.data?.prenom || ""} ${r.data?.nom || ""}`.trim() || r.data?.name || r.data?.email || uid;
        setDisplayName(name);
        localStorage.setItem(`client_display_name:${uid}`, name);
        return;
      } catch {}
      setDisplayName(uid);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const from = ymd(new Date(new Date().setDate(new Date().getDate() - 15)));
        const to   = ymd(new Date(new Date().getDate() + 45));
        let data = [];
        try {
          const r = await axios.get(`${API}/client/rendezvous`, { ...authHeader(), params: { from, to } });
          data = Array.isArray(r.data) ? r.data : [];
        } catch {
          const r = await axios.get(`${API}/client/rdv`, authHeader());
          data = Array.isArray(r.data) ? r.data : [];
        }

        const now = nowIso();
        const withUi = data.map((r) => {
          const endIso = `${r.date}T${r.heureFin}:00`;
          const statutUi = endIso < now && (r.statut || "planifie") === "planifie" ? "termine" : (r.statut || "planifie");
          return { ...r, statutUi };
        }).sort((a,b) => (`${a.date} ${a.heureDebut}`).localeCompare(`${b.date} ${b.heureDebut}`));

        setUpcoming(withUi.filter(r => `${r.date}T${r.heureFin}:00` >= now));
        setPast(withUi.filter(r => `${r.date}T${r.heureFin}:00` <  now));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const title = displayName ? `Bonjour ${displayName}` : "Espace Client";

  return (
    <div className="page-shell min-h-screen pb-12">
      <ClientTopBar />
      <div className="max-w-6xl mx-auto px-6 pt-10 animate-fade-in">
        <div className="mb-10">
          <h1 className="page-title text-3xl mb-2">{title}</h1>
          <p className="text-text-secondary">Bienvenue sur votre espace de suivi bancaire.</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Link to="/client-dashboard/projets" className="app-card group p-8 border-l-4 border-brand">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 rounded-xl bg-brand/10 text-brand">
                <FolderKanban className="h-6 w-6" />
              </div>
            </div>
            <h2 className="text-xl font-bold mb-2 group-hover:text-brand transition-colors">Mes projets</h2>
            <p className="text-text-muted text-sm leading-relaxed">Consultez l'avancement de vos dossiers et téléchargez vos documents validés.</p>
          </Link>

          <Link to="/client-dashboard/rdv" className="app-card group p-8 border-l-4 border-blue-500">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 rounded-xl bg-blue-500/10 text-blue-500">
                <CalendarClock className="h-6 w-6" />
              </div>
            </div>
            <h2 className="text-xl font-bold mb-2 group-hover:text-blue-500 transition-colors">Mes rendez-vous</h2>
            <p className="text-text-muted text-sm leading-relaxed">Planifiez une nouvelle session ou gérez vos rendez-vous en attente.</p>
          </Link>
        </div>

        <div className="grid md:grid-cols-2 gap-8 mt-12">
          <section className="app-card p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-2 h-2 rounded-full bg-brand animate-pulse" />
              <h2 className="section-title text-lg uppercase tracking-wider">À venir</h2>
            </div>
            {loading ? <p className="animate-pulse">Chargement…</p> :
              upcoming.length === 0 ? <p className="text-text-muted italic">Aucun rendez-vous à venir.</p> :
              <ul className="space-y-3">
                {upcoming.map(r => (
                  <li key={r.id} className="p-4 rounded-xl bg-bg-muted/30 border border-border-soft flex justify-between items-center">
                    <span className="font-medium text-text-primary">{r.date} — {r.heureDebut}</span>
                    <span className="status-badge status-pending text-[10px]">{r.statutUi}</span>
                  </li>
                ))}
              </ul>}
          </section>

          <section className="app-card p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-2 h-2 rounded-full bg-text-muted" />
              <h2 className="section-title text-lg uppercase tracking-wider">Passés</h2>
            </div>
            {loading ? <p className="animate-pulse">Chargement…</p> :
              past.length === 0 ? <p className="text-text-muted italic">Rien d'achevé pour l'instant.</p> :
              <ul className="space-y-3">
                {past.map(r => (
                  <li key={r.id} className="p-4 rounded-xl bg-bg-muted/10 border border-border-soft flex justify-between items-center opacity-70">
                    <span className="text-text-secondary">{r.date} — {r.heureDebut}</span>
                    <span className="status-badge status-active text-[10px]">{r.statutUi}</span>
                  </li>
                ))}
              </ul>}
          </section>
        </div>
      </div>
      {/* ✅ BOUTON SUPPRIMÉ ICI */}
    </div>
  );
}