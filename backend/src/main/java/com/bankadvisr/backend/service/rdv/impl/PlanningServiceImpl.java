package com.bankadvisr.backend.service.rdv.impl;

import com.bankadvisr.backend.dto.rdv.BulkCreneauxRequest;
import com.bankadvisr.backend.dto.rdv.CreneauDTO;
import com.bankadvisr.backend.service.rdv.PlanningService;
import com.google.cloud.firestore.*;
import com.google.firebase.cloud.FirestoreClient;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.ExecutionException;

@Service
public class PlanningServiceImpl implements PlanningService {

  private Firestore db() { return FirestoreClient.getFirestore(); }

  private static final DateTimeFormatter DF = DateTimeFormatter.ofPattern("yyyy-MM-dd");

  /* ===================== READ ===================== */

  @Override
  public List<CreneauDTO> findDisponibles(String consultanteUid, String from, String to) throws Exception {
    return queryRange(consultanteUid, from, to, "disponible");
  }

  @Override
  public List<CreneauDTO> findRange(String consultanteUid, String from, String to) throws Exception {
    return queryRange(consultanteUid, from, to, null);
  }

  private List<CreneauDTO> queryRange(String consultanteUid, String from, String to, String statut) throws Exception {
    CollectionReference coll = db()
        .collection("plannings")
        .document(consultanteUid)
        .collection("creneaux");

    Query q = coll.whereGreaterThanOrEqualTo("jour", from)
                  .whereLessThanOrEqualTo("jour", to)
                  .orderBy("jour")
                  .orderBy("heureDebut");

    List<QueryDocumentSnapshot> docs;
    try {
      docs = q.get().get().getDocuments();
    } catch (Exception e) {
      // fallback minimal : orderBy jour uniquement
      q = coll.whereGreaterThanOrEqualTo("jour", from)
              .whereLessThanOrEqualTo("jour", to)
              .orderBy("jour");
      docs = q.get().get().getDocuments();
    }

    List<CreneauDTO> out = new ArrayList<>();
    for (QueryDocumentSnapshot d : docs) {
      Map<String, Object> m = d.getData();
      String s = String.valueOf(m.getOrDefault("statut", "disponible"));
      if (statut == null || statut.equalsIgnoreCase(s)) {
        out.add(mapDocToDto(d));
      }
    }
    return out;
  }

  private CreneauDTO mapDocToDto(DocumentSnapshot d) {
    CreneauDTO dto = new CreneauDTO();
    dto.setId(d.getId());
    dto.setConsultanteUid(d.getReference().getParent().getParent().getId());
    dto.setJour(d.getString("jour"));
    dto.setHeureDebut(d.getString("heureDebut"));
    dto.setHeureFin(d.getString("heureFin"));
    dto.setStatut(d.getString("statut"));
    return dto;
  }

  /* ===================== WRITE ===================== */

  @Override
  public CreneauDTO createCreneau(String consultanteUid, CreneauDTO dto) throws Exception {
    validateHHMM(dto.getHeureDebut());
    validateHHMM(dto.getHeureFin());
    if (dto.getJour() == null || !dto.getJour().matches("\\d{4}-\\d{2}-\\d{2}"))
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "jour invalide (yyyy-MM-dd)");
    if (!(dto.getHeureDebut().compareTo(dto.getHeureFin()) < 0))
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "heureDebut doit être < heureFin");

    // refuse chevauchement
    ensureNoOverlap(consultanteUid, dto.getJour(), dto.getHeureDebut(), dto.getHeureFin(), null);

    Map<String, Object> data = new HashMap<>();
    data.put("jour", dto.getJour());
    data.put("heureDebut", dto.getHeureDebut());
    data.put("heureFin", dto.getHeureFin());
    data.put("statut", Optional.ofNullable(dto.getStatut()).orElse("disponible"));

    DocumentReference ref = db().collection("plannings")
        .document(consultanteUid)
        .collection("creneaux").document();

    ref.set(data).get();

    dto.setId(ref.getId());
    dto.setConsultanteUid(consultanteUid);
    dto.setStatut((String) data.get("statut"));
    return dto;
  }

  @Override
  public void updateCreneauStatut(String consultanteUid, String creneauId, String statut) throws Exception {
    if (statut == null || statut.isBlank())
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "statut requis");
    DocumentReference ref = db().collection("plannings").document(consultanteUid)
        .collection("creneaux").document(creneauId);
    DocumentSnapshot d = ref.get().get();
    if (!d.exists()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Créneau introuvable");
    ref.update("statut", statut).get();
  }

  @Override
  public void deleteCreneau(String consultanteUid, String creneauId) throws Exception {
    DocumentReference ref = db().collection("plannings").document(consultanteUid)
        .collection("creneaux").document(creneauId);
    ref.delete().get();
  }

  @Override
  public List<CreneauDTO> bulkGenerate(String consultanteUid, BulkCreneauxRequest req) throws Exception {
    // ===== valeurs “par défaut” si front ne les envoie pas =====
    String from = orDefault(req.getFrom(), today());
    String to   = orDefault(req.getTo(),   today());
    List<Integer> days = (req.getDaysOfWeek() == null || req.getDaysOfWeek().isEmpty())
        ? Arrays.asList(1,2,3,4,5) : req.getDaysOfWeek(); // L→V

    String morningStart   = orDefault(req.getMorningStart(),   "09:00");
    String morningEnd     = orDefault(req.getMorningEnd(),     "11:00"); // <- tu voulais 11:00
    String afternoonStart = orDefault(req.getAfternoonStart(), "14:00");
    String afternoonEnd   = orDefault(req.getAfternoonEnd(),   "16:00");
    int slotMinutes = req.getSlotMinutes() > 0 ? req.getSlotMinutes() : 60;

    String statut         = orDefault(req.getStatut(), "disponible");

    // validations
    validateHHMM(morningStart); validateHHMM(morningEnd);
    validateHHMM(afternoonStart); validateHHMM(afternoonEnd);
    if (!(morningStart.compareTo(morningEnd) < 0))
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Plage matin invalide");
    if (!(afternoonStart.compareTo(afternoonEnd) < 0))
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Plage après-midi invalide");

    LocalDate d0 = LocalDate.parse(from, DF);
    LocalDate d1 = LocalDate.parse(to, DF);
    if (d1.isBefore(d0)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "to < from");

    List<CreneauDTO> created = new ArrayList<>();

    // pour chaque date, si c’est un jour ciblé → on “remplit” par pas de slotMinutes
    for (LocalDate d = d0; !d.isAfter(d1); d = d.plusDays(1)) {
      int dow = d.getDayOfWeek().getValue(); // 1=Lundi … 7=Dimanche
      if (!days.contains(dow)) continue;

      String jour = d.format(DF);

      // matin
      created.addAll(fillRange(consultanteUid, jour, morningStart, morningEnd, slotMinutes, statut));

      // après-midi
      created.addAll(fillRange(consultanteUid, jour, afternoonStart, afternoonEnd, slotMinutes, statut));
    }

    return created;
  }

  /* ===================== helpers ===================== */

  private List<CreneauDTO> fillRange(
      String uid, String jour, String startHH, String endHH, int minutes, String statut
  ) throws ExecutionException, InterruptedException {
    List<CreneauDTO> out = new ArrayList<>();
    String cur = startHH;
    while (cur.compareTo(endHH) < 0) {
      String next = plusMinutes(cur, minutes);
      if (!(cur.compareTo(next) < 0) || next.compareTo(endHH) > 0) break;

      // pas de chevauchement avec existants : on “skip” si overlap
      if (hasOverlap(uid, jour, cur, next)) {
        cur = next;
        continue;
      }

      Map<String,Object> data = Map.of(
          "jour", jour,
          "heureDebut", cur,
          "heureFin", next,
          "statut", statut
      );
      DocumentReference ref = db().collection("plannings")
          .document(uid)
          .collection("creneaux").document();

      ref.set(data).get();

      CreneauDTO dto = new CreneauDTO();
      dto.setId(ref.getId());
      dto.setConsultanteUid(uid);
      dto.setJour(jour);
      dto.setHeureDebut(cur);
      dto.setHeureFin(next);
      dto.setStatut(statut);
      out.add(dto);

      cur = next;
    }
    return out;
  }

  private void ensureNoOverlap(String uid, String jour, String start, String end, String excludeId)
      throws ExecutionException, InterruptedException {
    CollectionReference coll = db().collection("plannings").document(uid).collection("creneaux");
    // récupération “light” du jour
    List<QueryDocumentSnapshot> docs = coll.whereEqualTo("jour", jour).get().get().getDocuments();
    for (QueryDocumentSnapshot d : docs) {
      if (excludeId != null && excludeId.equals(d.getId())) continue;
      String s = d.getString("heureDebut");
      String e = d.getString("heureFin");
      if (intervalsOverlap(start, end, s, e)) {
        throw new ResponseStatusException(HttpStatus.CONFLICT, "Chevauchement existant");
      }
    }
  }

  private boolean hasOverlap(String uid, String jour, String start, String end)
      throws ExecutionException, InterruptedException {
    CollectionReference coll = db().collection("plannings").document(uid).collection("creneaux");
    List<QueryDocumentSnapshot> docs = coll.whereEqualTo("jour", jour).get().get().getDocuments();
    for (QueryDocumentSnapshot d : docs) {
      String s = d.getString("heureDebut");
      String e = d.getString("heureFin");
      if (intervalsOverlap(start, end, s, e)) return true;
    }
    return false;
  }

  // [a,b) overlap [c,d)  -> a < d && c < b
  private boolean intervalsOverlap(String a, String b, String c, String d) {
    return a.compareTo(d) < 0 && c.compareTo(b) < 0;
  }

  private String plusMinutes(String hhmm, int min) {
    int h = Integer.parseInt(hhmm.substring(0,2));
    int m = Integer.parseInt(hhmm.substring(3,5));
    int total = h*60 + m + min;
    int hh = (total / 60) % 24;
    int mm = total % 60;
    return String.format("%02d:%02d", hh, mm);
  }

  private void validateHHMM(String hhmm) {
    if (hhmm == null || !hhmm.matches("\\d{2}:\\d{2}"))
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "format heure invalide (HH:mm)");
  }

  private String today() { return LocalDate.now().format(DF); }
  private String orDefault(String v, String def) { return (v == null || v.isBlank()) ? def : v; }
}
