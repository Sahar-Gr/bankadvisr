import React, { useEffect, useState, useCallback, useMemo } from "react";
import axios from "axios";
import ClientTopBar from "./ClientTopBar";
import { useToast } from "../../ui/Toast";
import { Calendar, dateFnsLocalizer, Views } from "react-big-calendar";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "../../../styles/rbc-dark.css";
import { format, parse, startOfWeek, addDays, getDay } from "date-fns";
import { fr } from "date-fns/locale";
import { CalendarClock, RefreshCw, AlertCircle } from "lucide-react";

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

export default function ClientAppointment() {
  const toast = useToast();
  const [date, setDate] = useState(() => { const d = new Date(); d.setHours(12, 0, 0, 0); return d; });
  const [view, setView] = useState(Views.WEEK);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);

  const { minTime, maxTime } = useMemo(() => {
    const min = new Date(); min.setHours(8, 0, 0);
    const max = new Date(); max.setHours(19, 0, 0);
    return { minTime: min, maxTime: max };
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const projRes = await axios.get(`${API}/client/projects`, auth());
      const defaultUid = projRes.data?.[0]?.consultanteUid || "";
      
      const start = startOfWeek(date, { weekStartsOn: 1 });
      const end = addDays(start, 6);
      
      const [slotsRes, rdvRes] = await Promise.all([
        axios.get(`${API}/client/creneaux-disponibles`, { ...auth(), params: { consultanteId: defaultUid, from: ymd(start), to: ymd(end) } }),
        axios.get(`${API}/client/rdv`, { ...auth(), params: { from: ymd(start), to: ymd(end) } })
      ]);

      const evSlots = (slotsRes.data || []).map(s => ({
        id: `slot:${s.id}`, title: "Disponible", start: new Date(`${s.jour}T${s.heureDebut}:00`), end: new Date(`${s.jour}T${s.heureFin}:00`), resource: { type: "slot" }
      }));
      const evRdvs = (rdvRes.data || []).map(r => ({
        id: `rdv:${r.id}`, title: "Mon RDV", start: new Date(`${r.date}T${r.heureDebut}:00`), end: new Date(`${r.date}T${r.heureFin}:00`), resource: { type: "rdv", statut: r.statut }
      }));

      setEvents([...evSlots.filter(s => !evRdvs.some(r => r.start.getTime() === s.start.getTime())), ...evRdvs]);
    } catch (e) {
      toast.error("Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, [date, toast]);

  useEffect(() => { loadData(); }, [loadData]);

  return (
    <div className="page-shell min-h-screen pb-12">
      <ClientTopBar />
      <div className="max-w-7xl mx-auto p-6 md:p-10 animate-fade-in">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="page-title text-2xl flex items-center gap-3 font-bold text-text-primary">
              <CalendarClock className="text-brand h-7 w-7" /> Mes Rendez-vous
            </h1>
          </div>
          <button onClick={loadData} className="app-btn app-btn-ghost p-2">
            <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {events.length === 0 && !loading ? (
          <div className="app-card p-16 text-center border-2 border-dashed border-border-soft">
            <AlertCircle className="mx-auto h-12 w-12 text-text-muted mb-4" />
            <h3 className="text-xl font-semibold text-text-primary">Aucun créneau disponible</h3>
            <p className="text-text-secondary mt-2">Votre consultante n'a pas encore ouvert de disponibilités pour cette semaine.</p>
          </div>
        ) : (
          <div className="app-card p-4 shadow-xl">
            <Calendar
              localizer={localizer}
              culture="fr"
              date={date}
              view={view}
              events={events}
              style={{ height: "65vh" }}
              selectable={false}
              onView={setView}
              onNavigate={setDate}
              min={minTime}
              max={maxTime}
              eventPropGetter={(evt) => {
                const type = evt.resource?.type;
                const s = (evt.resource?.statut || "").toLowerCase();
                let bg = type === 'slot' ? "var(--success)" : (s === 'confirme' ? "var(--brand)" : "var(--warning)");
                return { style: { backgroundColor: bg, border: "none", color: s === 'confirme' ? "#111" : "#fff", fontWeight: 600, borderRadius: '8px', opacity: type === 'slot' ? 0.8 : 1 } };
              }}
              messages={{ today: "Aujourd'hui", previous: "Précédent", next: "Suivant", month: "Mois", week: "Semaine", day: "Jour", agenda: "Agenda" }}
            />
          </div>
        )}
      </div>
    </div>
  );
}