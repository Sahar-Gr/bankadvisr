import React, { useEffect, useMemo, useState, useCallback } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import { useToast } from "../../ui/Toast";
import { Calendar, dateFnsLocalizer, Views } from "react-big-calendar";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "../../../styles/rbc-dark.css";
import { format, parse, startOfWeek, endOfWeek, getDay } from "date-fns";
import { fr } from "date-fns/locale";
import { PhoneCall, ChevronLeft, X } from "lucide-react";

const localizer = dateFnsLocalizer({
  format: (date, fmt) => format(date, fmt, { locale: fr }),
  parse: (str, fmt) => parse(str, fmt, new Date(), { locale: fr }),
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales: { fr },
});

const API = "http://localhost:8080/api";
const auth = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } });
const toDate = (jour, hhmm) => new Date(`${jour}T${hhmm}:00`);
const formatHHMM = (d) => format(d, "HH:mm");
const formatYMD = (d) => format(d, "yyyy-MM-dd");

const minTime = new Date();
minTime.setHours(8, 0, 0);

const maxTime = new Date();
maxTime.setHours(18, 0, 0);

function getUidFromToken() {
  try {
    const t = localStorage.getItem("token");
    if (!t) return "";
    const payload = JSON.parse(atob((t.split(".")[1] || "").replace(/-/g, "+").replace(/_/g, "/")));
    return payload.user_id || payload.uid || payload.sub || "";
  } catch { return ""; }
}

export default function Appointments() {
  const toast = useToast();
  const consultanteUid = useMemo(getUidFromToken, []);
  const [view, setView] = useState(Views.WEEK);
  const [currentDate, setCurrentDate] = useState(new Date());

  const [slots, setSlots] = useState([]);
  const [events, setEvents] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [selectedRdv, setSelectedRdv] = useState(null);
  const [projects, setProjects] = useState([]);
  const [projetId, setProjetId] = useState("");
  const [clientUid, setClientUid] = useState("");
  const [clients, setClients] = useState([]);
  const [subStart, setSubStart] = useState("");
  const [subEnd, setSubEnd] = useState("");

  const clientByUid = useMemo(() => Object.fromEntries(clients.map((c) => [c.uid, c])), [clients]);
  const labelUser = (u) => (u ? [u.nom, u.prenom].filter(Boolean).join(" ") || u.email : "Client inconnu");

  const load = useCallback(async () => {
    if (!consultanteUid) return;
    const s = startOfWeek(currentDate, { weekStartsOn: 1 });
    const e = endOfWeek(s, { weekStartsOn: 1 });
    const from = formatYMD(s), to = formatYMD(e);

    try {
      const [sRes, rRes, cRes, pRes] = await Promise.all([
        axios.get(`${API}/admin/planning/${consultanteUid}/creneaux`, { ...auth(), params: { from, to } }),
        axios.get(`${API}/rendezvous`, { ...auth(), params: { consultanteId: consultanteUid, from, to } }),
        axios.get(`${API}/admin/clients`, auth()),
        axios.get(`${API}/admin/projects`, auth())
      ]);

      setSlots(sRes.data || []);
      setClients(cRes.data || []);
      const mine = (pRes.data || []).filter(p => p.consultanteUid === consultanteUid || !p.consultanteUid);
      setProjects(mine);

      const evSlots = (sRes.data || []).map(s => ({
        id: `slot:${s.id}`,
        title: "Disponible",
        start: toDate(s.jour, s.heureDebut),
        end: toDate(s.jour, s.heureFin),
        resource: { type: "slot", slot: s, statut: s.statut }
      }));

      const evRdvs = (rRes.data || []).map(r => ({ 
        id: `rdv:${r.id}`, 
        title: `RDV: ${r.clientNom || "Client"}`, 
        start: toDate(r.date, r.heureDebut), 
        end: toDate(r.date, r.heureFin), 
        resource: { type: "rdv", rdv: r, statut: (r.statut || "en_attente").toLowerCase() } 
      }));

      setEvents([...evSlots.filter(es => !evRdvs.some(er => es.start.getTime() === er.start.getTime())), ...evRdvs]);
    } catch (err) { 
      toast.error("Erreur de chargement des données"); 
    }
  }, [consultanteUid, currentDate, toast]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const p = projects.find(x => x.id === projetId);
    if (p?.clientUid) setClientUid(p.clientUid);
  }, [projetId, projects]);

  const reserver = async (slot) => {
    if (!projetId) return toast.warning("Choisis un projet.");
    try {
      const body = { projetId, clientUid, consultanteUid, creneauId: slot.id, heureDebut: subStart || slot.heureDebut, heureFin: subEnd || slot.heureFin };
      await axios.post(`${API}/rendezvous`, body, auth());
      toast.success("RDV planifié.");
      setSelectedSlot(null);
      load();
    } catch (e) { toast.error("Erreur lors de la réservation"); }
  };

  const patchRdv = async (rdv, statut) => {
    try {
      await axios.patch(`${API}/rendezvous/${rdv.id}`, null, { ...auth(), params: { statut } });
      toast.success(`Statut mis à jour : ${statut}`);
      load();
      setSelectedRdv(null);
    } catch (e) { toast.error("Erreur de mise à jour"); }
  };

  return (
    <div className="animate-fade-in pt-4 pb-20">
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-3 text-brand">
            <PhoneCall className="h-8 w-8" />
            <h1 className="page-title text-text-primary text-2xl font-bold">Mes Rendez-vous</h1>
          </div>
          <p className="text-text-secondary">Gérez vos sessions.</p>
        </div>
        <Link to="/consultante-dashboard" className="app-btn app-btn-ghost text-sm">
          <ChevronLeft className="h-4 w-4 mr-2" /> Retour accueil
        </Link>
      </div>

      <div className="app-card p-4 mb-8 shadow-xl">
        <Calendar
          localizer={localizer}
          culture="fr"
          events={events}
          startAccessor="start"
          endAccessor="end"
          style={{ height: "70vh" }}
          selectable
          min={minTime}
          max={maxTime}
          view={view}
          onView={(newView) => setView(newView)}
          date={currentDate}
          onNavigate={(newDate) => setCurrentDate(new Date(newDate))}
          onSelectSlot={({start, end}) => {
            const s = slots.find(s => s.jour === formatYMD(start) && s.heureDebut <= formatHHMM(start) && formatHHMM(end) <= s.heureFin);
            if (s) { 
              setSelectedRdv(null); 
              setSelectedSlot(s); 
              setSubStart(formatHHMM(start)); 
              setSubEnd(formatHHMM(end)); 
            }
          }}
          onSelectEvent={e => { 
            if(e.resource.type === 'rdv') { 
              setSelectedSlot(null); 
              setSelectedRdv(e.resource.rdv); 
            } 
          }}
          eventPropGetter={(evt) => {
            const s = (evt.resource.statut || "").toLowerCase();
            let bg = evt.resource.type === 'slot' ? "var(--success)" : (s === 'confirme' ? "var(--brand)" : s === 'termine' ? "var(--secondary-btn)" : "var(--warning)");
            return { style: { backgroundColor: bg, border: "none", color: (s === 'confirme' || bg === 'var(--brand)') ? "#111" : "#fff", fontWeight: 600, borderRadius: '6px' } };
          }}
          messages={{
            today: "Aujourd'hui",
            previous: "Précédent",
            next: "Suivant",
            month: "Mois",
            week: "Semaine",
            day: "Jour",
            agenda: "Agenda",
            noEventsInRange: "Aucun événement."
          }}
        />
      </div>

      {selectedSlot && (
        <div className="app-card p-6 animate-fade-in border-l-4 border-l-brand mb-6 shadow-lg bg-bg-surface">
          <h3 className="text-lg font-bold mb-4">Planifier un rendez-vous</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="text-xs font-semibold uppercase text-text-muted mb-1 block">Projet concerné</label>
              <select className="app-input w-full" value={projetId} onChange={e => setProjetId(e.target.value)}>
                <option value="">— Sélectionner un projet —</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.titre} ({labelUser(clientByUid[p.clientUid])})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-text-muted mb-1 block">Horaire sélectionné</label>
              <div className="app-input flex items-center opacity-70 bg-bg-muted/20">{selectedSlot.jour} | {subStart} – {subEnd}</div>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => reserver(selectedSlot)} className="app-btn app-btn-primary px-6">Confirmer</button>
            <button onClick={() => setSelectedSlot(null)} className="app-btn app-btn-ghost">Annuler</button>
          </div>
        </div>
      )}

      {selectedRdv && (
        <div className="app-card p-6 animate-fade-in border-l-4 border-l-blue-500 shadow-lg bg-bg-surface">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h3 className="text-xl font-bold">Détails de la session</h3>
              <p className="text-sm text-text-muted mt-1">{selectedRdv.date} • {selectedRdv.heureDebut} – {selectedRdv.heureFin}</p>
            </div>
            <span className={`status-badge status-${selectedRdv.statut.toLowerCase() === 'en_attente' ? 'pending' : selectedRdv.statut.toLowerCase()}`}>
              {selectedRdv.statut}
            </span>
          </div>
          <div className="flex flex-wrap gap-3 pt-4 border-t border-border-soft">
            <button onClick={() => patchRdv(selectedRdv, "confirme")} className="app-btn app-btn-primary">Confirmer</button>
            <button onClick={() => patchRdv(selectedRdv, "termine")} className="app-btn app-btn-ghost text-text-primary">Terminer</button>
            <button onClick={() => patchRdv(selectedRdv, "annule")} className="app-btn app-btn-danger">Annuler</button>
            <div className="flex-grow"></div>
            <button onClick={() => setSelectedRdv(null)} className="app-btn app-btn-ghost border border-border-soft">
              <X className="h-4 w-4 mr-2" /> Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}