package com.bankadvisr.backend.service.rdv.impl;

import com.bankadvisr.backend.dto.rdv.BulkCreneauxRequest;
import com.bankadvisr.backend.dto.rdv.CreneauDTO;
import com.bankadvisr.backend.service.rdv.PlanningService;
import com.google.cloud.firestore.*;
import com.google.firebase.cloud.FirestoreClient;
import org.springframework.context.annotation.Primary;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Service
@Primary
public class FirestorePlanningService implements PlanningService {

  private Firestore db() { return FirestoreClient.getFirestore(); }

  // --- Normalisation & validations ------------------------------------------

  private static final DateTimeFormatter ISO = DateTimeFormatter.ofPattern("yyyy-MM-dd");
  private static final DateTimeFormatter FR  = DateTimeFormatter.ofPattern("dd/MM/yyyy");

  /** Accepte "yyyy-MM-dd" OU "dd/MM/yyyy", retourne toujours "yyyy-MM-dd". */
  private static String normalizeDate(String s) {
    if (s == null || s.isBlank())
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le champ 'jour' est obligatoire.");
    s = s.trim();
    try {
      if (s.contains("/")) return LocalDate.parse(s, FR).format(ISO);
      return LocalDate.parse(s).format(ISO); // <input type="date"> -> yyyy-MM-dd
    } catch (Exception e) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Format de date invalide (utilise yyyy-MM-dd).");
    }
  }

  private static LocalTime mustTime(String label, String s) {
    if (s == null || s.isBlank())
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le champ '" + label + "' est obligatoire.");
    try {
      return LocalTime.parse(s.trim()); // "HH:mm"
    } catch (Exception e) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Heure invalide pour '" + label + "' (HH:mm).");
    }
  }

  private static boolean overlap(LocalTime a1, LocalTime a2, LocalTime b1, LocalTime b2) {
    return a1.isBefore(b2) && b1.isBefore(a2); // [a1,a2] ∩ [b1,b2] ≠ ∅
  }

  private static CreneauDTO toDto(DocumentSnapshot doc) {
    CreneauDTO c = new CreneauDTO();
    c.setId(doc.getId());
    c.setConsultanteUid(doc.getReference().getParent().getParent().getId());
    c.setJour(doc.getString("jour"));               // yyyy-MM-dd
    c.setHeureDebut(doc.getString("heureDebut"));   // HH:mm
    c.setHeureFin(doc.getString("heureFin"));       // HH:mm
    c.setStatut(doc.getString("statut"));           // disponible | reserve | indisponible
    return c;
  }

  // --- API ------------------------------------------------------------------

  @Override
  public List<CreneauDTO> findDisponibles(String consultanteUid, String from, String to) throws Exception {
    String f = normalizeDate(from);
    String t = normalizeDate(to);

    CollectionReference coll = db()
      .collection("plannings").document(consultanteUid).collection("creneaux");

    List<QueryDocumentSnapshot> docs = coll
      .whereGreaterThanOrEqualTo("jour", f)
      .whereLessThanOrEqualTo("jour", t)
      .get().get().getDocuments();

    return docs.stream()
      .map(FirestorePlanningService::toDto)
      .filter(c -> "disponible".equalsIgnoreCase(c.getStatut()))
      .sorted(Comparator.comparing(CreneauDTO::getJour)
              .thenComparing(CreneauDTO::getHeureDebut))
      .collect(Collectors.toList());
  }

  @Override
  public CreneauDTO createCreneau(String consultanteUid, CreneauDTO dto) throws Exception {
    String jour = normalizeDate(dto.getJour());
    LocalTime h1 = mustTime("heureDebut", dto.getHeureDebut());
    LocalTime h2 = mustTime("heureFin",   dto.getHeureFin());
    if (!h1.isBefore(h2))
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "heureDebut doit être < heureFin.");

    CollectionReference coll = db()
      .collection("plannings").document(consultanteUid).collection("creneaux");

    // anti-chevauchement sur le même jour (hors 'indisponible')
    for (DocumentSnapshot d : coll.whereEqualTo("jour", jour).get().get().getDocuments()) {
      String st = d.getString("statut");
      if (!"indisponible".equalsIgnoreCase(st)) {
        LocalTime b1 = LocalTime.parse(Objects.toString(d.getString("heureDebut"), "00:00"));
        LocalTime b2 = LocalTime.parse(Objects.toString(d.getString("heureFin"),   "00:00"));
        if (overlap(h1, h2, b1, b2))
          throw new ResponseStatusException(HttpStatus.CONFLICT, "Chevauchement avec un autre créneau.");
      }
    }

    Map<String, Object> data = new HashMap<>();
    data.put("jour", jour);
    data.put("heureDebut", h1.toString());
    data.put("heureFin",   h2.toString());
    data.put("statut", Optional.ofNullable(dto.getStatut()).orElse("disponible"));
    data.put("createdAt", FieldValue.serverTimestamp());

    DocumentReference ref = coll.document();
    ref.set(data).get();

    CreneauDTO out = new CreneauDTO();
    out.setId(ref.getId());
    out.setConsultanteUid(consultanteUid);
    out.setJour(jour);
    out.setHeureDebut(h1.toString());
    out.setHeureFin(h2.toString());
    out.setStatut((String) data.get("statut"));
    return out;
  }

  @Override
  public void updateCreneauStatut(String consultanteUid, String creneauId, String statut) throws Exception {
    db().collection("plannings").document(consultanteUid)
      .collection("creneaux").document(creneauId)
      .update("statut", statut, "updatedAt", FieldValue.serverTimestamp()).get();
  }

  @Override
  public void deleteCreneau(String consultanteUid, String creneauId) throws Exception {
    db().collection("plannings").document(consultanteUid)
      .collection("creneaux").document(creneauId).delete().get();
  }

  // --------------------- Génération en masse -------------------------------

  @Override
  public List<CreneauDTO> bulkGenerate(String consultanteUid, BulkCreneauxRequest req) throws Exception {
    LocalDate from = LocalDate.parse(normalizeDate(req.getFrom()));
    LocalDate to   = LocalDate.parse(normalizeDate(req.getTo()));
    if (to.isBefore(from)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "'to' < 'from'");

    int step = req.getSlotMinutes() > 0 ? req.getSlotMinutes() : 60;

    Set<Integer> days = (req.getDaysOfWeek() == null || req.getDaysOfWeek().isEmpty())
        ? Set.of(1,2,3,4,5)  // Lun→Ven par défaut
        : new HashSet<>(req.getDaysOfWeek());

    LocalTime mStart = mustTime("morningStart",   req.getMorningStart());
    LocalTime mEnd   = mustTime("morningEnd",     req.getMorningEnd());
    LocalTime aStart = mustTime("afternoonStart", req.getAfternoonStart());
    LocalTime aEnd   = mustTime("afternoonEnd",   req.getAfternoonEnd());

    CollectionReference coll = db()
        .collection("plannings").document(consultanteUid).collection("creneaux");

    List<CreneauDTO> created = new ArrayList<>();

    for (LocalDate d = from; !d.isAfter(to); d = d.plusDays(1)) {
      int dow = d.getDayOfWeek().getValue(); // 1 = Lundi ... 7 = Dimanche
      if (!days.contains(dow)) continue;

      String jour = d.format(ISO);

      // existants du jour (pour éviter chevauchements)
      List<DocumentSnapshot> existing = new ArrayList<>();
existing.addAll(coll.whereEqualTo("jour", jour).get().get().getDocuments());


      created.addAll(generateWindow(coll, consultanteUid, jour, mStart, mEnd, step, req.getStatut(), existing));
      created.addAll(generateWindow(coll, consultanteUid, jour, aStart, aEnd, step, req.getStatut(), existing));
    }

    return created;
  }

  private List<CreneauDTO> generateWindow(
    CollectionReference coll,
    String consultanteUid,
    String jour,
    LocalTime start,
    LocalTime end,
    int stepMinutes,
    String statut,
    List<DocumentSnapshot> existing
) throws Exception {
  List<CreneauDTO> out = new ArrayList<>();
  if (!start.isBefore(end)) return out;

  // ---- MODE BLOC : un slot unique pour toute la fenêtre ----
  if (stepMinutes <= 0) {
    // anti-chevauchement (ignore 'indisponible')
    for (DocumentSnapshot d : existing) {
      String st = d.getString("statut");
      if ("indisponible".equalsIgnoreCase(st)) continue;
      LocalTime b1 = LocalTime.parse(Objects.toString(d.getString("heureDebut"), "00:00"));
      LocalTime b2 = LocalTime.parse(Objects.toString(d.getString("heureFin"),   "00:00"));
      boolean overlap = start.isBefore(b2) && b1.isBefore(end);  // [start,end) chevauche [b1,b2) ?
      if (overlap) return out; // on ne crée pas ce bloc s'il chevauche
    }

    Map<String, Object> data = new HashMap<>();
    data.put("jour", jour);
    data.put("heureDebut", start.toString()); // ex: 09:00
    data.put("heureFin",   end.toString());   // ex: 12:00
    data.put("statut", (statut == null ? "disponible" : statut));
    data.put("createdAt", FieldValue.serverTimestamp());

    DocumentReference ref = coll.document();
    ref.set(data).get();

    CreneauDTO c = new CreneauDTO();
    c.setId(ref.getId());
    c.setConsultanteUid(consultanteUid);
    c.setJour(jour);
    c.setHeureDebut(start.toString());
    c.setHeureFin(end.toString());
    c.setStatut((String) data.get("statut"));
    out.add(c);

    existing.add(ref.get().get());
    return out;
  }

  // ---- MODE STEP (découpage 60/30/15 min) ----
  for (LocalTime t = start; t.plusMinutes(stepMinutes).compareTo(end) <= 0; t = t.plusMinutes(stepMinutes)) {
    LocalTime t2 = t.plusMinutes(stepMinutes);

    boolean clash = false;
    for (DocumentSnapshot d : existing) {
      String st = d.getString("statut");
      if ("indisponible".equalsIgnoreCase(st)) continue;
      LocalTime b1 = LocalTime.parse(Objects.toString(d.getString("heureDebut"), "00:00"));
      LocalTime b2 = LocalTime.parse(Objects.toString(d.getString("heureFin"),   "00:00"));
      if (overlap(t, t2, b1, b2)) { clash = true; break; }  // demi-ouvert : adjacents OK
    }
    if (clash) continue;

    Map<String, Object> data = new HashMap<>();
    data.put("jour", jour);
    data.put("heureDebut", t.toString());
    data.put("heureFin",   t2.toString());
    data.put("statut", (statut == null ? "disponible" : statut));
    data.put("createdAt", FieldValue.serverTimestamp());

    DocumentReference ref = coll.document();
    ref.set(data).get();

    CreneauDTO c = new CreneauDTO();
    c.setId(ref.getId());
    c.setConsultanteUid(consultanteUid);
    c.setJour(jour);
    c.setHeureDebut(t.toString());
    c.setHeureFin(t2.toString());
    c.setStatut((String) data.get("statut"));
    out.add(c);

    existing.add(ref.get().get());
  }
  return out;
}
@Override
public List<CreneauDTO> findRange(String consultanteUid, String from, String to) throws Exception {
  String f = normalizeDate(from);
  String t = normalizeDate(to);

  CollectionReference coll = db()
      .collection("plannings").document(consultanteUid).collection("creneaux");

  List<QueryDocumentSnapshot> docs = coll
      .whereGreaterThanOrEqualTo("jour", f)
      .whereLessThanOrEqualTo("jour", t)
      .get().get().getDocuments();

  return docs.stream()
      .map(FirestorePlanningService::toDto)
      .sorted(Comparator.comparing(CreneauDTO::getJour)
          .thenComparing(CreneauDTO::getHeureDebut))
      .collect(Collectors.toList());
}

  }

