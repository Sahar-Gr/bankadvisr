import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import { useToast } from "../../ui/Toast";
import { Calendar, dateFnsLocalizer, Views } from "react-big-calendar";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "../../../styles/rbc-dark.css";
import { format, parse, startOfWeek, endOfWeek, getDay, addMinutes } from "date-fns";
import { fr } from "date-fns/locale";
import { CalendarDays, ChevronLeft } from "lucide-react";

const localizer = dateFnsLocalizer({
  format: (date, fmt) => format(date, fmt, { locale: fr }),
  parse: (str, fmt) => parse(str, fmt, new Date(), { locale: fr }),
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales: { fr },
});

const API = "http://localhost:8080/api";
const auth = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } });
const ymd = (d) => format(d, "yyyy-MM-dd");
const toDate = (jour, hhmm) => new Date(`${jour}T${hhmm}:00`);

function getUidFromToken() {
  try {
    const t = localStorage.getItem("token");
    if (!t) return "";
    const payload = JSON.parse(atob((t.split(".")[1] || "").replace(/-/g, "+").replace(/_/g, "/")));
    return payload.user_id || payload.uid || payload.sub || "";
  } catch { return ""; }
}

const slotToEvent = (s) => ({
  id: `slot:${s.id}`,
  title: s.statut === "indisponible" ? "Indisponible" : "Disponible",
  start: toDate(s.jour, s.heureDebut),
  end:   toDate(s.jour, s.heureFin),
  resource: { type: "slot", slot: s, statut: s.statut || "disponible" },
});

const rdvToEvent = (r) => ({
  id: `rdv:${r.id}`,
  title: `RDV — ${r.heureDebut}–${r.heureFin}`,
  start: toDate(r.date, r.heureDebut),
  end:   toDate(r.date, r.heureFin),
  resource: { type: "rdv", rdv: r, statut: (r.statut || "en_attente").toLowerCase() },
});

function visibleRange(date, view) {
  if (view === Views.DAY) return { from: ymd(date), to: ymd(date) };
  const s = startOfWeek(date, { weekStartsOn: 1 });
  const e = endOfWeek(s, { weekStartsOn: 1 });
  return { from: ymd(s), to: ymd(e) };
}

export default function Planning() {
  const toast = useToast();
  const consultanteUid = useMemo(getUidFromToken, []);
  const [view, setView] = useState(Views.WEEK);
  const [date, setDate] = useState(() => { const d = new Date(); d.setHours(12, 0, 0, 0); return d; });
  const [events, setEvents] = useState([]);

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

  const load = useCallback(async () => {
    if (!consultanteUid) return;
    const { from, to } = visibleRange(date, view);
    try {
      const { data: slots } = await axios.get(`${API}/admin/planning/${consultanteUid}/creneaux`, { ...auth(), params: { from, to } });
      const evSlots = (slots || []).map(slotToEvent);
      let evRdvs = [];
      try {
        const { data: rdvs } = await axios.get(`${API}/rendezvous`, { ...auth(), params: { consultanteId: consultanteUid, from, to } });
        evRdvs = (rdvs || []).map(rdvToEvent);
      } catch (e) {}
      const ev = [...evSlots.filter(es => !evRdvs.some(er => es.start.getTime() === er.start.getTime() && es.end.getTime() === er.end.getTime())), ...evRdvs];
      setEvents(ev);
    } catch (e) { toast.error("Erreur de chargement du planning"); }
  }, [consultanteUid, date, view, toast]);

  useEffect(() => { load(); }, [load]);

  const onSelectSlot = async ({ start, end }) => {
    if (!consultanteUid) return;
    if (start.getTime() === end.getTime()) end = addMinutes(start, 30);
    const jour = ymd(start);
    const hD = format(start, "HH:mm");
    const hF = format(end, "HH:mm");

    if (!window.confirm(`Créer un créneau le ${jour} de ${hD} à ${hF} ?`)) return;

    try {
      await axios.post(`${API}/admin/planning/${consultanteUid}/creneaux`, { 
        jour, 
        heureDebut: hD, 
        heureFin: hF, 
        statut: "disponible" 
      }, auth());

      toast.success("Créneau créé.");
      load();
    } catch (e) {
      toast.error("Erreur de création.");
    }
  };

  return (
    <div className="animate-fade-in pt-4">
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-3 text-brand">
            <CalendarDays className="h-8 w-8" />
            <h1 className="page-title text-text-primary text-2xl font-bold">Mon Planning</h1>
          </div>
          <p className="text-text-secondary">Définissez vos créneaux de disponibilité pour les clients.</p>
        </div>
        <Link to="/consultante-dashboard" className="app-btn app-btn-ghost text-sm flex items-center gap-2">
          <ChevronLeft className="h-4 w-4" /> Retour accueil
        </Link>
      </div>

      <div className="app-card p-4 mb-6 shadow-xl border border-border-soft bg-bg-surface rounded-2xl">
        <Calendar
          localizer={localizer}
          culture="fr"
          view={view}
          onView={setView}
          date={date}
          onNavigate={(d) => setDate(new Date(d))}
          events={events}
          startAccessor="start"
          endAccessor="end"
          style={{ height: "70vh" }}
          selectable
          onSelectSlot={onSelectSlot}
          eventPropGetter={eventPropGetter}
          messages={{
            today: "Aujourd'hui",
            previous: "Précédent",
            next: "Suivant",
            month: "Mois",
            week: "Semaine",
            day: "Jour",
            agenda: "Agenda",
            noEventsInRange: "Aucun créneau."
          }}
          min={new Date(1970, 0, 1, 8, 0)}
          max={new Date(1970, 0, 1, 20, 0)}
          step={30}
          timeslots={2}
        />
      </div>
    </div>
  );
}