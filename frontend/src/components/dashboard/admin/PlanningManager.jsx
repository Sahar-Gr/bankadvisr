// frontend/src/components/dashboard/admin/PlanningManager.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import ThemeToggle from "../../ThemeToggle";
import { Link } from "react-router-dom";

import { Calendar, dateFnsLocalizer, Views } from "react-big-calendar";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "../../../styles/rbc-dark.css";

import { format, parse, startOfWeek, endOfWeek, getDay, addMinutes } from "date-fns";
import { fr } from "date-fns/locale";

/* ---- calendar i18n ---- */
const localizer = dateFnsLocalizer({
  format: (date, fmt) => format(date, fmt, { locale: fr }),
  parse: (str, fmt) => parse(str, fmt, new Date(), { locale: fr }),
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales: { fr },
});

/* ---- API ---- */
const API = "http://localhost:8080/api";
const auth = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } });

/* ---- utils ---- */
const ymd = (d) => format(d, "yyyy-MM-dd");
const toEventFromSlot = (c, consultanteUid) => ({
  id: `slot:${c.id}`,
  title: c.statut === "indisponible" ? "Indisponible" : "Disponible",
  start: new Date(`${c.jour}T${c.heureDebut}:00`),
  end:   new Date(`${c.jour}T${c.heureFin}:00`),
  resource: { type: "slot", statut: c.statut || "disponible", consultanteUid, slot: c },
});
const toEventFromRdv = (r) => ({
  id: `rdv:${r.id}`,
  title: `RDV — ${r.heureDebut}–${r.heureFin}`,
  start: new Date(`${r.date}T${r.heureDebut}:00`),
  end:   new Date(`${r.date}T${r.heureFin}:00`),
  resource: { type: "rdv", rdv: r, statut: (r.statut || "en_attente").toLowerCase() },
});

function visibleRange(date, view) {
  if (view === Views.DAY) {
    const d = new Date(date); d.setHours(12,0,0,0);
    return { from: ymd(d), to: ymd(d) };
  }
  const s = startOfWeek(date, { weekStartsOn: 1 });
  const e = endOfWeek(date, { weekStartsOn: 1 });
  return { from: ymd(s), to: ymd(e) };
}

export default function PlanningManager() {
  const [consultantes, setConsultantes] = useState([]); // [{uid, nom, prenom, email}]
  const [consultanteUid, setConsultanteUid] = useState("");

  const [events, setEvents] = useState([]);
  const [view, setView] = useState(Views.WEEK);
  const [date, setDate] = useState(() => { const d=new Date(); d.setHours(12,0,0,0); return d; });
  const [selectedEvt, setSelectedEvt] = useState(null);
  const [loading, setLoading] = useState(false);

  /* UI helpers */
  const messages = useMemo(() => ({
    today: "Aujourd'hui",
    previous: "Précédent",
    next: "Suivant",
    month: "Mois",
    week: "Semaine",
    day: "Jour",
    agenda: "Agenda",
    noEventsInRange: loading ? "Chargement..." : "Aucun élément.",
  }), [loading]);

  const eventPropGetter = (evt) => {
    const t = evt?.resource?.type;
    const s = (evt?.resource?.statut || "").toLowerCase();
    
    let bg = "var(--success)";
    if (t === "rdv") {
      if (s === "annule") bg = "var(--danger)";
      else if (s === "termine") bg = "var(--secondary-btn)";
      else if (s === "confirme") bg = "var(--brand)";
      else bg = "var(--warning)";
    }
    if (t === "slot" && s === "indisponible") bg = "var(--danger)";
    
    return { style: { backgroundColor: bg, border: "none", color: (t === "rdv" && s === "confirme") ? "#111" : "#fff", fontWeight: 600 } };
  };

  /* 1) charger les consultantes pour le sélecteur */
  useEffect(() => {
    (async () => {
      try {
        const { data } = await axios.get(`${API}/admin/consultantes`, auth());
        const arr = Array.isArray(data) ? data : [];
        setConsultantes(arr);
        if (!consultanteUid && arr[0]?.uid) setConsultanteUid(arr[0].uid);
      } catch (e) {
        console.error("GET /admin/consultantes", e?.response || e);
        alert("Impossible de charger la liste des consultantes.");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* 2) charger slots + rdv pour la plage visible */
  const load = useCallback(async () => {
    if (!consultanteUid) { setEvents([]); return; }
    const { from, to } = visibleRange(date, view);
    setLoading(true);
    try {
      const { data: slotsData } = await axios.get(
        `${API}/admin/planning/${consultanteUid}/creneaux`,
        { ...auth(), params: { from, to } }
      );
      const evSlots = (Array.isArray(slotsData) ? slotsData : []).map(s => toEventFromSlot(s, consultanteUid));

      let evRdvs = [];
      try {
        const { data: rdvData } = await axios.get(
          `${API}/rendezvous`,
          { ...auth(), params: { consultanteId: consultanteUid, from, to } }
        );
        evRdvs = (Array.isArray(rdvData) ? rdvData : []).map(toEventFromRdv);
      } catch {}

      const ev = [
        ...evSlots.filter(
          (es) => !evRdvs.some(
            (er) => es.start.getTime()===er.start.getTime() && es.end.getTime()===er.end.getTime()
          )
        ),
        ...evRdvs,
      ];
      setEvents(ev);
      setSelectedEvt(null);
    } catch (e) {
      console.error("Chargement planning admin", e?.response || e);
      alert("Échec du chargement du planning.");
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [consultanteUid, date, view]);

  useEffect(() => { load(); }, [load]);

  /* création d’un créneau en cliquant/drag sur zone vide */
  const onSelectSlot = useCallback(async ({ start, end }) => {
    if (!consultanteUid) { alert("Choisis une consultante d’abord."); return; }
    if (start.getTime() === end.getTime()) end = addMinutes(start, 30);

    const jour = ymd(start);
    const heureDebut = format(start, "HH:mm");
    const heureFin   = format(end, "HH:mm");

    if (!window.confirm(`Créer un créneau le ${jour} de ${heureDebut} à ${heureFin} ?`)) return;

    try {
      const body = { jour, heureDebut, heureFin, statut: "disponible" };
      const { data } = await axios.post(`${API}/admin/planning/${consultanteUid}/creneaux`, body, auth());
      setEvents((prev) => [...prev, toEventFromSlot(data, consultanteUid)]);
      localStorage.setItem("planning:changed", String(Date.now()));
    } catch (e) {
      if (e?.response?.status === 409) alert("Chevauchement avec un autre créneau.");
      else alert("Échec de la création du créneau.");
    }
  }, [consultanteUid]);

  /* suppression d’un créneau sélectionné */
  const deleteSelected = useCallback(async () => {
    const evt = selectedEvt;
    if (!evt || evt?.resource?.type !== "slot") {
      alert("Sélectionne un créneau pour le supprimer.");
      return;
    }
    const slotId = evt?.resource?.slot?.id;
    const uid = evt?.resource?.consultanteUid || consultanteUid;
    if (!slotId || !uid) {
      alert("Identifiant du créneau introuvable.");
      return;
    }
    if (!window.confirm("Supprimer ce créneau ?")) return;

    try {
      await axios.delete(`${API}/admin/planning/${uid}/creneaux/${slotId}`, auth());
      setEvents(prev => prev.filter(e => e.id !== evt.id));
      setSelectedEvt(null);
      localStorage.setItem("planning:changed", String(Date.now()));
      await load(); // “nettoyer” les cas limites
    } catch (e) {
      console.error("DELETE slot", e?.response || e);
      const status = e?.response?.status;
      const server =
        e?.response?.data?.message ||
        e?.response?.data?.error ||
        (typeof e?.response?.data === "string" ? e.response.data : null);
      alert(`Échec de la suppression du créneau.\n(${status || "?"}) ${server || e?.message}`);
    }
  }, [selectedEvt, consultanteUid, load]);


/* Génération automatique (Bulk) de la semaine visible */
  const generateBulkSlots = async () => {
    if (!consultanteUid) { 
      alert("Choisis une consultante d'abord."); 
      return; 
    }
    
    // On récupère les dates de la vue actuelle du calendrier
    const { from, to } = visibleRange(date, view);
    
    if (!window.confirm(`Générer automatiquement les créneaux types (9h-12h / 14h-16h) du ${from} au ${to} ?\n(Les créneaux existants ne seront pas écrasés)`)) {
      return;
    }

    setLoading(true);
    try {
      const payload = {
        from: from,
        to: to,
        daysOfWeek: [1, 2, 3, 4, 5], // Du Lundi (1) au Vendredi (5)
        slotMinutes: 30,             // Des créneaux de 30 minutes
        morningStart: "09:00",
        morningEnd: "12:00",
        afternoonStart: "14:00",
        afternoonEnd: "16:00",
        statut: "disponible"
      };

      await axios.post(`${API}/admin/planning/${consultanteUid}/creneaux:bulk`, payload, auth());
      
      localStorage.setItem("planning:changed", String(Date.now()));
      await load(); // On recharge le calendrier avec les nouveaux créneaux
      
    } catch (e) {
      console.error("Erreur génération bulk", e);
      alert("Échec de la génération automatique des créneaux.");
    } finally {
      setLoading(false);
    }
  };

  /* navigation */
  const onNavigate = (d) => { const nd=new Date(d); nd.setHours(12,0,0,0); setDate(nd); };
  const onViewChange = (v) => setView(v);

  return (
    <div className="page-shell min-h-screen pb-12">
      <div className="max-w-6xl mx-auto p-6">
        <div className="mb-4">
          <Link to="/admin-dashboard" className="text-blue-400 dark:text-blue-600 hover:underline">← Retour</Link>
        </div>

        <h1 className="text-2xl font-bold mb-4">Planning — Admin</h1>

        {/* Sélecteur consultante */}
        <div className="app-card p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
            <div>
              <label className="text-xs text-muted font-semibold uppercase mb-1 block">Consultante</label>
              <select className="app-input" value={consultanteUid} onChange={(e)=>setConsultanteUid(e.target.value)}>
                {consultantes.length === 0 && <option value="">— Aucune consultante —</option>}
                {consultantes.map(c => (
                  <option key={c.uid} value={c.uid}>{[c.nom, c.prenom].filter(Boolean).join(" ") || c.email || c.uid}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-end mt-4 md:mt-0">
              <div className="text-sm text-secondary font-medium">
                {loading ? "Chargement..." : `${events.length} éléments affichés`}
              </div>
              
              {consultanteUid && (
                <button 
                  onClick={generateBulkSlots} 
                  disabled={loading}
                  className="app-btn app-btn-primary py-2 px-4 shadow-sm"
                >
                  ⚡ Générer 9h-12h / 14h-16h
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="app-card p-2 md:p-4 mb-6">
          <Calendar
            localizer={localizer}
            culture="fr"
            date={date}
            onNavigate={onNavigate}
            view={view}
            onView={onViewChange}
            events={events}
            startAccessor="start"
            endAccessor="end"
            style={{ height: "70vh" }}
            selectable
            onSelectSlot={onSelectSlot}
            onSelectEvent={(evt)=>setSelectedEvt(evt)}
            eventPropGetter={eventPropGetter}
            messages={messages}
            min={new Date(1970,0,1,8,0)}
            max={new Date(1970,0,1,18,30)}
            scrollToTime={new Date(1970,0,1,9,0)}
            step={30}
            timeslots={2}
          />
        </div>

        {selectedEvt && (
          <div className="app-card p-6 animate-fade-in border-l-4 border-l-brand">
            <h3 className="card-title mb-2">Événement sélectionné</h3>
            <div className="text-muted mb-6">
              <span className="font-medium text-text-primary">{format(selectedEvt.start, "dd/MM/yyyy")}</span> — {format(selectedEvt.start, "HH:mm")} à {format(selectedEvt.end, "HH:mm")}
              <span className="ml-2 px-2 py-1 bg-bg-muted rounded text-xs">{selectedEvt.resource?.type === "rdv" ? "Rendez-vous" : "Créneau libre"}</span>
            </div>
            
            <div className="flex gap-3 pt-4 border-t border-border-soft">
              {selectedEvt.resource?.type === "slot" && selectedEvt.resource?.slot?.id && (
                <button onClick={deleteSelected} className="app-btn app-btn-danger">
                  Supprimer le créneau
                </button>
              )}
              <button onClick={()=>setSelectedEvt(null)} className="app-btn app-btn-ghost">
                Fermer
              </button>
            </div>
          </div>
        )}
      </div>
      
      {/* Ajout du ThemeToggle ici, dans le conteneur principal */}
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle />
      </div>
    </div>
  );
}