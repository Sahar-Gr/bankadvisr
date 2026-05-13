// src/components/dashboard/admin/AppointmentManager.jsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import axios from "axios";
import ThemeToggle from "../../ThemeToggle";
import { Link } from "react-router-dom";
import { useToast } from "../../ui/Toast";

import { Calendar, dateFnsLocalizer, Views } from "react-big-calendar";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "../../../styles/rbc-dark.css";

import { format, parse, startOfWeek, endOfWeek, getDay } from "date-fns";
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
const ymd   = (d) => format(d, "yyyy-MM-dd");
const toDate= (jour, hhmm) => new Date(`${jour}T${hhmm}:00`);
const hhmm  = (d) => format(d, "HH:mm");

const slotToEvent = (s, consultanteUid) => ({
  id: `slot:${s.id}`,
  title: s.statut === "indisponible" ? "Indisponible" : "Disponible",
  start: toDate(s.jour, s.heureDebut),
  end:   toDate(s.jour, s.heureFin),
  resource: { type: "slot", statut: s.statut || "disponible", slot: s, consultanteUid },
});

const rdvToEvent = (r, clientByUid) => {
  const nom =
    (clientByUid?.[r.clientUid] &&
      [clientByUid[r.clientUid].nom, clientByUid[r.clientUid].prenom].filter(Boolean).join(" ")) ||
    r.clientNom || r.clientUid || "Client";
  return {
    id: `rdv:${r.id}`,
    title: `${nom} — ${r.heureDebut}–${r.heureFin}`,
    start: toDate(r.date, r.heureDebut),
    end:   toDate(r.date, r.heureFin),
    resource: { type: "rdv", rdv: r, statut: (r.statut || "en_attente").toLowerCase() },
  };
};

function visibleRange(date, view) {
  if (view === Views.DAY) return { from: ymd(date), to: ymd(date) };
  const s = startOfWeek(date, { weekStartsOn: 1 });
  const e = endOfWeek(s, { weekStartsOn: 1 });
  return { from: ymd(s), to: ymd(e) };
}

export default function AppointmentManager() {
  const toast = useToast();

  /* référentiels */
  const [clients, setClients] = useState([]);
  const [projects, setProjects] = useState([]);
  const [consultantes, setConsultantes] = useState([]);

  /* sélection courante */
  const [projetId, setProjetId] = useState("");
  const [consultanteUid, setConsultanteUid] = useState("");

  /* calendrier */
  const [date, setDate] = useState(() => { const d=new Date(); d.setHours(12,0,0,0); return d; });
  const [view, setView] = useState(Views.WEEK);

  /* données */
  const [events, setEvents] = useState([]);
  const [rdvs, setRdvs] = useState([]);

  /* sélection (slot/rdv) */
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [selectedRdv, setSelectedRdv] = useState(null);

  /* sous-plage */
  const [subStart, setSubStart] = useState("");
  const [subEnd, setSubEnd] = useState("");
  const [duration, setDuration] = useState(30);

  const clientByUid = useMemo(
    () => Object.fromEntries(clients.map((c) => [c.uid, c])),
    [clients]
  );
  const labelUser = (u) =>
    u ? [u.nom, u.prenom].filter(Boolean).join(" ") || u.email || u.uid : "";

  const onErr = useCallback((err, label) => {
    const status = err?.response?.status;
    const server =
      err?.response?.data?.message ||
      err?.response?.data?.error ||
      (typeof err?.response?.data === "string" ? err.response.data : null);
    const msg = server || err?.message || "Erreur inconnue";
    console.error(label, status, err?.response?.data || err);
    toast.error(`${label} — échec (${status || "?"})${msg ? ` : ${msg}` : ""}`);
  }, [toast]);

  /* 1) charger référentiels */
  useEffect(() => {
    (async () => {
      try {
        const [c, p, co] = await Promise.all([
          axios.get(`${API}/admin/clients`, auth()),
          axios.get(`${API}/admin/projects`, auth()),
          axios.get(`${API}/admin/consultantes`, auth()),
        ]);
        const clientsArr = Array.isArray(c.data) ? c.data : [];
        const projectsArr = Array.isArray(p.data) ? p.data : [];
        const consultArr  = Array.isArray(co.data) ? co.data : [];
        setClients(clientsArr);
        setProjects(projectsArr);
        setConsultantes(consultArr);

        if (!projetId && projectsArr[0]?.id) setProjetId(projectsArr[0].id);
        if (!consultanteUid && consultArr[0]?.uid) setConsultanteUid(consultArr[0].uid);
      } catch (e) {
        onErr(e, "Chargement clients/projets/consultantes");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* 2) auto-renseigner consultante via projet si dispo */
  useEffect(() => {
    const proj = projects.find((p) => p.id === projetId);
    const fromProject = proj?.consultanteUid || proj?.consultanteId;
    if (fromProject && fromProject !== consultanteUid) setConsultanteUid(fromProject);
  }, [projetId, projects]); // eslint-disable-line

  /* 3) charger slots + rdv */
  const rangeFromCurrentView = useCallback(() => {
    const d = new Date(date);
    if (view === Views.DAY) return { from: ymd(d), to: ymd(d) };
    const s = startOfWeek(d, { weekStartsOn: 1 });
    const e = endOfWeek(d, { weekStartsOn: 1 });
    return { from: ymd(s), to: ymd(e) };
  }, [date, view]);

  const load = useCallback(async () => {
    if (!consultanteUid) { setEvents([]); setRdvs([]); return; }
    const { from, to } = rangeFromCurrentView();
    try {
      const { data: slotsData } = await axios.get(
        `${API}/admin/planning/${consultanteUid}/creneaux`,
        { ...auth(), params: { from, to } }
      );
      const rowsSlots = Array.isArray(slotsData) ? slotsData : [];
      const evSlots = rowsSlots.map(s => slotToEvent(s, consultanteUid));

      let rdvRows = [];
      try {
        const { data } = await axios.get(
          `${API}/rendezvous`,
          { ...auth(), params: { consultanteId: consultanteUid, from, to } }
        );
        rdvRows = Array.isArray(data) ? data : [];
        setRdvs(rdvRows);
      } catch (e) {
        setRdvs([]);
      }

      const evRdvs = rdvRows.map((r) => rdvToEvent(r, clientByUid));

      const ev = [
        ...evSlots.filter(
          (es) => !evRdvs.some(
            (er) => es.start.getTime()===er.start.getTime() && es.end.getTime()===er.end.getTime()
          )
        ),
        ...evRdvs,
      ];
      setEvents(ev);
      setSelectedSlot(null);
      setSelectedRdv(null);
      setSubStart(""); setSubEnd("");
    } catch (e) {
      onErr(e, "Chargement du planning");
    }
  }, [consultanteUid, clientByUid, rangeFromCurrentView, onErr]);

  useEffect(() => { load(); }, [consultanteUid, date, view, load]);

  /* navigation stabilisée */
  const onRangeChange = useCallback((rng) => {
    if (Array.isArray(rng) && rng.length) {
      const mid = rng[Math.floor(rng.length / 2)];
      const d = new Date(mid); d.setHours(12,0,0,0);
      setDate(d);
    } else if (rng?.start) {
      const d = new Date(rng.start); d.setHours(12,0,0,0);
      setDate(d);
    }
  }, []);

  /* couleurs */
  const eventPropGetter = (evt) => {
    const t = evt?.resource?.type;
    const statut = (evt?.resource?.statut || "").toLowerCase();

    let bg = "var(--success)"; // Vert (Disponible)

    if (t === "rdv") {
      if (statut === "annule") bg = "var(--danger)";
      else if (statut === "termine") bg = "var(--secondary-btn)";
      else if (statut === "confirme") bg = "var(--brand)"; // Doré !
      else bg = "var(--warning)"; // Orange
    }

    if (t === "slot" && statut === "indisponible") {
      bg = "var(--danger)";
    }

    return {
      style: {
        backgroundColor: bg,
        color: (t === "rdv" && statut === "confirme") ? "#111" : "#fff",
      }
    };
  };

  /* sélection calendrier */
  const onSelectSlot = ({ start, end }) => {
    const selDay = ymd(start);
    const sHH = hhmm(start);
    const eHH = hhmm(end);
    const containing = events
      .filter(e => e.resource?.type === "slot")
      .map(e => e.resource.slot)
      .find(s => s.jour === selDay && s.heureDebut <= sHH && eHH <= s.heureFin && sHH < eHH);
    if (!containing) return;
    setSelectedRdv(null);
    setSelectedSlot(containing);
    setSubStart(sHH);
    setSubEnd(eHH);
  };

  const onSelectEvent = (evt) => {
    if (evt?.resource?.type === "slot") {
      const s = evt.resource.slot;
      setSelectedRdv(null);
      setSelectedSlot(s);
      setSubStart(s.heureDebut);
      setSubEnd("");
    } else if (evt?.resource?.type === "rdv") {
      setSelectedSlot(null);
      setSelectedRdv(evt.resource.rdv);
    }
  };

  /* réserver (admin) */
  const reserver = async (slot, startHH, endHH) => {
    const proj = projects.find(p => p.id === projetId);
    const clientUid = proj?.clientUid;
    if (!proj) { toast.warning("Choisis un projet."); return; }
    if (!clientUid) { toast.warning("Ce projet n’a pas de client associé."); return; }

    try {
      const start = startHH || subStart || slot.heureDebut;
let end = endHH || subEnd || "";

if (!end) {
  const [h, m] = start.split(":").map(Number);
  const total = h * 60 + m + Number(duration || 30);
  const hh = String(Math.floor(total / 60) % 24).padStart(2, "0");
  const mm = String(total % 60).padStart(2, "0");
  end = `${hh}:${mm}`;
}

      if (!(start < end)) { toast.warning("Heure début doit être < heure fin."); return; }
      if (!(start >= slot.heureDebut && end <= slot.heureFin)) {
        toast.warning(`Sous-plage hors du créneau ${slot.heureDebut}–${slot.heureFin}.`);
        return;
      }

      const body = {
        projetId,
        clientUid,
        consultanteUid,
        creneauId: slot.id,
        heureDebut: start,
        heureFin: end,
      };

      const { data } = await axios.post(`${API}/rendezvous`, body, auth());
      const evR = rdvToEvent(data, clientByUid);

      setEvents(prev => {
        const same = (e) => e.start.getTime()===evR.start.getTime() && e.end.getTime()===evR.end.getTime();
        return [...prev.filter(e => !(e.resource?.type==="slot" && same(e))), evR];
      });
      setSelectedSlot(null);
      localStorage.setItem("rendezvous:changed", String(Date.now()));
      toast.success("✅ RDV planifié (confirmé).");
      await load();
    } catch (e) {
      if (e?.response?.status === 409) toast.warning("Collision/chevauchement. Choisis un autre horaire.");
      else onErr(e, "Création du RDV");
    }
  };

  /* helpers maj état RDV */
  const updateRdvStatusInState = (rdvId, newStatut) => {
    setEvents(prev =>
      prev.map(e =>
        e.id === `rdv:${rdvId}`
          ? { ...e, resource: { ...e.resource, statut: newStatut, rdv: { ...e.resource.rdv, statut: newStatut } } }
          : e
      )
    );
    setSelectedRdv((curr) => (curr && curr.id === rdvId ? { ...curr, statut: newStatut } : curr));
  };

  /* actions RDV admin */
  const setRdvStatus = async (rdv, statut) => {
    try {
      await axios.patch(`${API}/rendezvous/${rdv.id}`, null, { ...auth(), params: { statut } });
      updateRdvStatusInState(rdv.id, statut);
      localStorage.setItem("rendezvous:changed", String(Date.now()));
      toast.success(
        statut === "confirme" ? "RDV confirmé." :
        statut === "annule"   ? "RDV annulé."   :
        statut === "termine"  ? "RDV terminé."  : "Statut mis à jour."
      );
    } catch (e) {
      onErr(e, `Mise à jour du RDV (${statut})`);
    }
  };

  const cancelRdv  = (rdv) => setRdvStatus(rdv, "annule");
  const confirmRdv = (rdv) => setRdvStatus(rdv, "confirme");
  const finishRdv  = (rdv) => setRdvStatus(rdv, "termine");

  const deleteRdv = async (rdv) => {
    if (!window.confirm("Supprimer définitivement ce RDV ?")) return;
    try {
      await axios.delete(`${API}/rendezvous/${rdv.id}`, auth());
      setEvents(prev => prev.filter(e => e.id !== `rdv:${rdv.id}`));
      setSelectedRdv(null);
      localStorage.setItem("rendezvous:changed", String(Date.now()));
      toast.success("RDV supprimé.");
    } catch (e) {
      onErr(e, "Suppression du RDV");
    }
  };

  // auto-refresh feedback
  useEffect(() => {
    const onFocus = () => load();
    const onStorage = (e) => {
      if (e.key === "planning:changed" || e.key === "rendezvous:changed") {
        toast.info("Mise à jour détectée.");
        load();
      }
    };
    window.addEventListener("focus", onFocus);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("storage", onStorage);
    };
  }, [load, toast]);

  return (
    <div className="page-shell min-h-screen pb-12 pt-8">
      <div className="absolute top-4 right-4"><ThemeToggle /></div>
      <div className="mx-auto w-full max-w-[1600px] px-6">
        <div className="mb-4">
          <Link to="/admin-dashboard" className="text-blue-400 dark:text-blue-600 hover:underline">← Retour</Link>
        </div>

        <h1 className="text-2xl font-bold mb-4">Rendez-vous — Admin</h1>

        {/* Sélecteur Consultante + Projet */}
        <div className="app-card mb-4 p-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
            <div>
              <div className="text-xs opacity-70 mb-1">Consultante</div>
              <select
                className="app-input w-full"
                value={consultanteUid}
                onChange={(e) => setConsultanteUid(e.target.value)}
              >
                <option value="">— Choisir —</option>
                {consultantes.map((c) => (
                  <option key={c.uid} value={c.uid}>
                    {[c.nom, c.prenom].filter(Boolean).join(" ") || c.email || c.uid}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <div className="text-xs opacity-70 mb-1">Projet</div>
              <select
                className="app-input w-full"
                value={projetId}
                onChange={(e)=>setProjetId(e.target.value)}
              >
                <option value="">— Choisir un projet —</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.titre || p.id}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Calendrier */}
        <div className="mx-auto w-full max-w-none px-8">
          <Calendar
            localizer={localizer}
            culture="fr"
            date={date}
            onNavigate={(d)=>{ const nd=new Date(d); nd.setHours(12,0,0,0); setDate(nd); }}
            view={view}
            onView={setView}
            onRangeChange={onRangeChange}
            events={events}
            startAccessor="start"
            endAccessor="end"
            
            /* --- C'EST ICI QUE TOUT CHANGE --- */
            style={{ height: "70vh" }} /* Même hauteur que le planning */
            selectable
            onSelectEvent={onSelectEvent}
            onSelectSlot={onSelectSlot}
            eventPropGetter={eventPropGetter}
            messages={{
              today: "Aujourd'hui", previous: "Précédent", next: "Suivant",
              month: "Mois", week: "Semaine", day: "Jour", agenda: "Agenda",
              noEventsInRange: "Aucun créneau ou RDV."
            }}
            min={new Date(1970,0,1,8,0)}
            max={new Date(1970,0,1,19,0)} /* Même heure de fin que le planning */
            scrollToTime={new Date(1970,0,1,9,0)}
            step={30}
            timeslots={2} /* <--- LE SECRET EST LÀ : 2 blocs par heure au lieu de 1 */
          />
        </div>

        {/* Panneau réservation (slot) */}
        {selectedSlot && (
          <div className="mt-6 app-card p-6 animate-fade-in border-l-4 border-l-brand">
            <div className="font-semibold text-lg mb-4">
              Créneau disponible — {selectedSlot.jour} • {selectedSlot.heureDebut}–{selectedSlot.heureFin}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end mb-6">
              <div className="md:col-span-3">
                <label className="text-xs text-muted font-semibold uppercase mb-1 block">Projet</label>
                <select className="app-input" value={projetId} onChange={(e)=>setProjetId(e.target.value)}>
                  <option value="">— Choisir un projet —</option>
                  {projects.map((p)=>(<option key={p.id} value={p.id}>{p.titre || p.id}</option>))}
                </select>
              </div>
              <div className="md:col-span-3">
                <label className="text-xs text-muted font-semibold uppercase mb-1 block">Client (auto)</label>
                <input disabled className="app-input opacity-60 cursor-not-allowed" 
                       value={(projects.find(p => p.id === projetId)?.clientUid && labelUser(clientByUid[projects.find(p => p.id === projetId)?.clientUid])) || "—"} />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs text-muted font-semibold uppercase mb-1 block">Début</label>
                <input type="time" className="app-input" value={subStart} onChange={(e)=>setSubStart(e.target.value)} />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs text-muted font-semibold uppercase mb-1 block">Fin</label>
                <input type="time" className="app-input" value={subEnd} onChange={(e)=>setSubEnd(e.target.value)} />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs text-muted font-semibold uppercase mb-1 block">Durée par défaut</label>
                <select className="app-input" value={duration} onChange={(e)=>setDuration(Number(e.target.value))}>
                  <option value={15}>15 min</option><option value={30}>30 min</option><option value={45}>45 min</option><option value={60}>60 min</option>
                </select>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 pt-4 border-t border-border-soft">
              <button onClick={() => reserver(selectedSlot, selectedSlot.heureDebut, selectedSlot.heureFin)} className="app-btn app-btn-primary">Réserver le créneau complet</button>
              <button onClick={() => reserver(selectedSlot, subStart, subEnd)} className="app-btn app-btn-ghost text-brand border-brand">Réserver la sélection</button>
              <button onClick={() => { setSelectedSlot(null); setSubStart(""); setSubEnd(""); }} className="app-btn app-btn-ghost">Annuler</button>
            </div>
          </div>
        )}

        {/* Panneau détails RDV */}
        {selectedRdv && (
          <div className="mt-6 app-card p-6 animate-fade-in border-l-4 border-l-blue-500">
            <div className="flex justify-between items-start mb-4">
              <h3 className="card-title text-xl">Détails du rendez-vous</h3>
              <span className={`status-badge status-${selectedRdv.statut.toLowerCase() === 'en_attente' ? 'pending' : selectedRdv.statut.toLowerCase()}`}>
                {selectedRdv.statut}
              </span>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-4 mb-2">
              <div><div className="text-xs text-muted font-semibold uppercase">Client</div><div className="font-medium mt-1">{labelUser(clientByUid[selectedRdv.clientUid]) || selectedRdv.clientNom || selectedRdv.clientUid}</div></div>
              <div><div className="text-xs text-muted font-semibold uppercase">Date</div><div className="font-medium mt-1">{selectedRdv.date}</div></div>
              <div><div className="text-xs text-muted font-semibold uppercase">Horaire</div><div className="font-medium mt-1">{selectedRdv.heureDebut} – {selectedRdv.heureFin}</div></div>
            </div>

            <div className="flex flex-wrap gap-3 pt-4 border-t border-border-soft">
              <button onClick={()=>confirmRdv(selectedRdv)} className="app-btn app-btn-primary">Confirmer</button>
              <button onClick={()=>finishRdv(selectedRdv)} className="app-btn app-btn-ghost">Terminer</button>
              <button onClick={()=>cancelRdv(selectedRdv)} className="app-btn app-btn-danger">Annuler</button>
              <button onClick={()=>deleteRdv(selectedRdv)} className="app-btn app-btn-secondary opacity-70">Supprimer</button>
              <div className="flex-grow"></div>
              <button onClick={()=>setSelectedRdv(null)} className="app-btn app-btn-ghost">Fermer</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
