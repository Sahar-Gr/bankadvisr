package com.bankadvisr.backend.service.rdv.impl;

import com.bankadvisr.backend.dto.rdv.CreateRdvRequest;
import com.bankadvisr.backend.dto.rdv.RendezVousDTO;
import com.bankadvisr.backend.service.rdv.RendezVousService;
import com.bankadvisr.backend.util.IcsUtil;
import com.google.cloud.firestore.*;
import com.google.firebase.cloud.FirestoreClient;
import org.springframework.context.annotation.Primary;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalTime;
import java.time.ZoneId;
import java.util.*;
import java.util.stream.Collectors;

@Service
@Primary
public class FirestoreRendezVousService implements RendezVousService {

  private Firestore db() { return FirestoreClient.getFirestore(); }

  private static RendezVousDTO toDto(DocumentSnapshot d) {
    RendezVousDTO r = new RendezVousDTO();
    r.setId(d.getId());
    r.setProjetId(d.getString("projetId"));
    r.setClientUid(d.getString("clientUid"));
    r.setConsultanteUid(d.getString("consultanteUid"));
    r.setDate(d.getString("date"));
    r.setHeureDebut(d.getString("heureDebut"));
    r.setHeureFin(d.getString("heureFin"));
    r.setType(d.getString("type"));
    r.setStatut(d.getString("statut"));
    r.setLienVisio(d.getString("lienVisio"));
    return r;
  }

  @Override
  public List<RendezVousDTO> getByDateForRole(String date, String role, String uid) throws Exception {
    List<QueryDocumentSnapshot> docs = db().collection("rendezvous")
        .whereEqualTo("date", date)
        .get().get().getDocuments();

    return docs.stream().map(FirestoreRendezVousService::toDto)
        .filter(r -> {
          if ("admin".equalsIgnoreCase(role)) return true;
          if ("client".equalsIgnoreCase(role)) return uid != null && uid.equals(r.getClientUid());
          if ("consultante".equalsIgnoreCase(role)) return uid != null && uid.equals(r.getConsultanteUid());
          return true;
        })
        .sorted(Comparator.comparing(RendezVousDTO::getHeureDebut))
        .collect(Collectors.toList());
  }

  /* ---------- helpers ---------- */

  private boolean overlap(LocalTime a1, LocalTime a2, LocalTime b1, LocalTime b2) {
    // chevauchement strict [a1,a2[ ∩ [b1,b2[ ≠ ∅
    return a1.isBefore(b2) && b1.isBefore(a2);
  }

  /** Vérifie l’absence de conflit avec des RDV déjà "confirme" sur la même consultante/date. */
  private void ensureNoCollisionOnConfirm(Transaction t,
                                          String consultanteUid,
                                          String date,
                                          LocalTime start,
                                          LocalTime end,
                                          String excludeRdvId) throws Exception {
    QuerySnapshot snap = t.get(
        db().collection("rendezvous")
            .whereEqualTo("consultanteUid", consultanteUid)
            .whereEqualTo("date", date)
            .whereEqualTo("statut", "confirme")
    ).get();

    for (DocumentSnapshot d : snap.getDocuments()) {
      if (excludeRdvId != null && excludeRdvId.equals(d.getId())) continue;
      LocalTime s2 = LocalTime.parse(Objects.toString(d.getString("heureDebut"), "00:00"));
      LocalTime e2 = LocalTime.parse(Objects.toString(d.getString("heureFin"), "00:00"));
      if (overlap(start, end, s2, e2)) {
        throw new ResponseStatusException(HttpStatus.CONFLICT, "Conflit avec un RDV confirmé.");
      }
    }
  }

  /* ---------- reserver ---------- */

  @Override
  public RendezVousDTO reserver(CreateRdvRequest req, String actorUid, String actorRole) throws Exception {
    Firestore db = db();

    DocumentReference slotRef = db.collection("plannings").document(req.getConsultanteUid())
        .collection("creneaux").document(req.getCreneauId());
    DocumentReference rdvRef = db.collection("rendezvous").document();

    // statut initial : client ⇒ en_attente ; admin|consultante ⇒ confirme
    final String initialStatut =
        "client".equalsIgnoreCase(actorRole) ? "en_attente" : "confirme";

    return db.runTransaction(transaction -> {
      DocumentSnapshot slot = transaction.get(slotRef).get();
      if (!slot.exists())
        throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Créneau introuvable");

      String statut = slot.getString("statut");
      if (!"disponible".equalsIgnoreCase(statut))
        throw new ResponseStatusException(HttpStatus.CONFLICT, "Créneau déjà réservé");

      String jour = Objects.toString(slot.getString("jour"), "");
      LocalTime slotStart = LocalTime.parse(Objects.toString(slot.getString("heureDebut"), "00:00"));
      LocalTime slotEnd   = LocalTime.parse(Objects.toString(slot.getString("heureFin"), "00:00"));
      if (!slotStart.isBefore(slotEnd))
        throw new ResponseStatusException(HttpStatus.CONFLICT, "Créneau invalide.");

      // Sous-plage demandée ? (sinon, tout le créneau)
      LocalTime resStart = (req.getHeureDebut() != null && !req.getHeureDebut().isBlank())
          ? LocalTime.parse(req.getHeureDebut().trim()) : slotStart;
      LocalTime resEnd   = (req.getHeureFin()   != null && !req.getHeureFin().isBlank())
          ? LocalTime.parse(req.getHeureFin().trim())   : slotEnd;

      if (!resStart.isBefore(resEnd))
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "heureDebut doit être < heureFin.");
      if (resStart.isBefore(slotStart) || resEnd.isAfter(slotEnd))
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Sous-plage hors du créneau disponible.");

      // Si création directe "confirme" ⇒ vérif anti-collision
      if ("confirme".equals(initialStatut)) {
        ensureNoCollisionOnConfirm(transaction, req.getConsultanteUid(), jour, resStart, resEnd, null);
      }

      // Split du créneau: delete original + recréer left | mid | right
      transaction.delete(slotRef);
      CollectionReference coll = db.collection("plannings")
          .document(req.getConsultanteUid())
          .collection("creneaux");

      if (slotStart.isBefore(resStart)) {
        transaction.set(coll.document(), Map.of(
            "jour", jour,
            "heureDebut", slotStart.toString(),
            "heureFin",   resStart.toString(),
            "statut",     "disponible",
            "createdAt",  FieldValue.serverTimestamp()
        ));
      }

      // milieu réservé (toujours "reserve" côté planning)
      transaction.set(coll.document(), Map.of(
          "jour", jour,
          "heureDebut", resStart.toString(),
          "heureFin",   resEnd.toString(),
          "statut",     "reserve",
          "createdAt",  FieldValue.serverTimestamp()
      ));

      if (resEnd.isBefore(slotEnd)) {
        transaction.set(coll.document(), Map.of(
            "jour", jour,
            "heureDebut", resEnd.toString(),
            "heureFin",   slotEnd.toString(),
            "statut",     "disponible",
            "createdAt",  FieldValue.serverTimestamp()
        ));
      }

      // Création du RDV
      Map<String, Object> rdv = new HashMap<>();
      rdv.put("projetId", req.getProjetId());
      rdv.put("clientUid", req.getClientUid());
      rdv.put("consultanteUid", req.getConsultanteUid());
      rdv.put("date", jour);
      rdv.put("heureDebut", resStart.toString());
      rdv.put("heureFin", resEnd.toString());
      rdv.put("type", "visio");
      rdv.put("statut", initialStatut); // en_attente | confirme
      rdv.put("createdAt", FieldValue.serverTimestamp());
      transaction.set(rdvRef, rdv);

      RendezVousDTO dto = new RendezVousDTO();
      dto.setId(rdvRef.getId());
      dto.setProjetId(req.getProjetId());
      dto.setClientUid(req.getClientUid());
      dto.setConsultanteUid(req.getConsultanteUid());
      dto.setDate(jour);
      dto.setHeureDebut(resStart.toString());
      dto.setHeureFin(resEnd.toString());
      dto.setType("visio");
      dto.setStatut(initialStatut);
      return dto;
    }).get();
  }

  /* ---------- update statut ---------- */

  @Override
  public void updateStatut(String rdvId, String statut) throws Exception {
    Firestore db = db();
    DocumentReference rdvRef = db.collection("rendezvous").document(rdvId);

    db.runTransaction(t -> {
      DocumentSnapshot d = t.get(rdvRef).get();
      if (!d.exists()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "RDV introuvable");

      String consultanteUid = Objects.toString(d.getString("consultanteUid"), "");
      String date = Objects.toString(d.getString("date"), "");
      LocalTime start = LocalTime.parse(Objects.toString(d.getString("heureDebut"), "00:00"));
      LocalTime end   = LocalTime.parse(Objects.toString(d.getString("heureFin"), "00:00"));

      // Confirmation => anti-collision
      if ("confirme".equalsIgnoreCase(statut)) {
        ensureNoCollisionOnConfirm(t, consultanteUid, date, start, end, rdvId);
        t.update(rdvRef, Map.of("statut", "confirme", "updatedAt", FieldValue.serverTimestamp()));
        return null;
      }

      // Annulation => libère la plage si elle existe
      if ("annule".equalsIgnoreCase(statut)) {
        CollectionReference coll = db.collection("plannings").document(consultanteUid).collection("creneaux");
        QuerySnapshot q = t.get(
            coll.whereEqualTo("jour", date)
                .whereEqualTo("heureDebut", start.toString())
                .whereEqualTo("heureFin", end.toString())
        ).get();

        for (DocumentSnapshot s : q.getDocuments()) {
          t.update(s.getReference(), Map.of("statut", "disponible", "updatedAt", FieldValue.serverTimestamp()));
        }
        t.update(rdvRef, Map.of("statut", "annule", "updatedAt", FieldValue.serverTimestamp()));
        return null;
      }

      // Terminé => simple mise à jour
      if ("termine".equalsIgnoreCase(statut)) {
        t.update(rdvRef, Map.of("statut", "termine", "updatedAt", FieldValue.serverTimestamp()));
        return null;
      }

      // fallback
      t.update(rdvRef, Map.of("statut", statut, "updatedAt", FieldValue.serverTimestamp()));
      return null;
    }).get();
  }

  /* ---------- delete ---------- */

  @Override
  public void delete(String rdvId) throws Exception {
    DocumentReference rdvRef = db().collection("rendezvous").document(rdvId);
    DocumentSnapshot d = rdvRef.get().get();
    if (!d.exists()) return;

    String consultanteUid = d.getString("consultanteUid");
    String date = d.getString("date");
    String h1 = d.getString("heureDebut");
    String h2 = d.getString("heureFin");

    if (consultanteUid != null && date != null && h1 != null && h2 != null) {
      CollectionReference coll = db().collection("plannings").document(consultanteUid).collection("creneaux");
      List<QueryDocumentSnapshot> same = coll
          .whereEqualTo("jour", date)
          .whereEqualTo("heureDebut", h1)
          .whereEqualTo("heureFin", h2)
          .get().get().getDocuments();

      if (!same.isEmpty()) {
        DocumentReference cRef = same.get(0).getReference();
        db().runTransaction(t -> {
          t.update(cRef, "statut", "disponible", "updatedAt", FieldValue.serverTimestamp());
          t.delete(rdvRef);
          return null;
        }).get();
        return;
      }
    }
    rdvRef.delete().get();
  }

  /* ---------- visio & ICS ---------- */

  @Override
  public String startVisio(String rdvId) throws Exception {
    DocumentReference ref = db().collection("rendezvous").document(rdvId);
    DocumentSnapshot d = ref.get().get();
    if (!d.exists()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "RDV introuvable");
    String url = d.getString("lienVisio");
    if (url == null || url.isBlank()) {
      url = "https://meet.jit.si/consulting-" + rdvId;
      ref.update("lienVisio", url, "statut", "en_cours", "updatedAt", FieldValue.serverTimestamp()).get();
    }
    return url;
  }

  @Override
  public String generateICS(String rdvId) throws Exception {
    DocumentSnapshot d = db().collection("rendezvous").document(rdvId).get().get();
    if (!d.exists()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "RDV introuvable");
    RendezVousDTO rdv = toDto(d);
    return IcsUtil.build(rdv, ZoneId.systemDefault());
  }
}
