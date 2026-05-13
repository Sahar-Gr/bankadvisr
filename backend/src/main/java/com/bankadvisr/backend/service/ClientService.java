package com.bankadvisr.backend.service;

import com.google.cloud.firestore.*;
import com.google.firebase.cloud.FirestoreClient;
import com.google.firebase.cloud.StorageClient;
import com.google.cloud.storage.Blob;
import com.google.cloud.storage.Bucket;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.net.URL;
import java.util.*;
import java.util.concurrent.TimeUnit;

@Service
public class ClientService {

  private Firestore db() { return FirestoreClient.getFirestore(); }

  /* ========= Liste des consultantes (dropdown côté client) ========= */
  public List<Map<String,Object>> listConsultantesLight() throws Exception {
    CollectionReference coll = db().collection("users");
    Query q = coll.whereEqualTo("role", "consultante");
    List<QueryDocumentSnapshot> docs;
    try {
      docs = q.orderBy("nom").get().get().getDocuments();
    } catch (Exception e) {
      docs = q.get().get().getDocuments(); // fallback sans index
    }
    List<Map<String,Object>> out = new ArrayList<>();
    for (QueryDocumentSnapshot d : docs) {
      Map<String,Object> m = new HashMap<>();
      m.put("uid", d.getId());
      m.put("nom", d.getString("nom"));
      m.put("prenom", d.getString("prenom"));
      m.put("email", d.getString("email"));
      out.add(m);
    }
    return out;
  }

  /* =================== PROJETS =================== */

  public Map<String, Object> getMyProject(String clientUid, String projectId) throws Exception {
    DocumentSnapshot d = db().collection("projects").document(projectId).get().get();
    if (!d.exists()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Projet introuvable");
    if (!Objects.equals(d.getString("clientUid"), clientUid))
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Accès refusé");

    Map<String, Object> m = d.getData();
    if (m == null) m = new HashMap<>();
    m.put("id", d.getId());
    return m;
  }

  public List<Map<String, Object>> getMyProjects(String clientUid) throws Exception {
    CollectionReference coll = db().collection("projects");
    Query base = coll.whereEqualTo("clientUid", clientUid);

    List<QueryDocumentSnapshot> docs;
    try {
      docs = base.orderBy("createdAt", Query.Direction.DESCENDING).get().get().getDocuments();
    } catch (Exception ex) {
      docs = base.get().get().getDocuments();
    }

    List<Map<String, Object>> out = new ArrayList<>();
    for (QueryDocumentSnapshot d : docs) {
      Map<String, Object> m = d.getData();
      m.put("id", d.getId());
      out.add(m);
    }
    return out;
  }

  /* =================== DOCUMENTS =================== */

  public List<Map<String, Object>> getProjectDocuments(String projectId) throws Exception {
    CollectionReference coll = db().collection("projects").document(projectId).collection("documents");
    Query q = coll.orderBy("createdAt", Query.Direction.DESCENDING);
    List<QueryDocumentSnapshot> docs = q.get().get().getDocuments();
    List<Map<String, Object>> out = new ArrayList<>();
    for (QueryDocumentSnapshot d : docs) {
      Map<String, Object> m = d.getData();
      m.put("id", d.getId());
      out.add(m);
    }
    return out;
  }

  public Map<String, Object> uploadClientDocument(String clientUid, String projectId, MultipartFile file) throws Exception {
    DocumentSnapshot proj = db().collection("projects").document(projectId).get().get();
    if (!proj.exists()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Projet introuvable");
    String statutGlobal = String.valueOf(proj.getString("statutGlobal"));
    if ("termine".equalsIgnoreCase(statutGlobal))
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Projet clôturé");

    if (file == null || file.isEmpty())
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Aucun fichier");

    String ext = Optional.ofNullable(file.getOriginalFilename())
        .orElse("file")
        .replaceAll("^.*\\.", "");
    String blobPath = String.format("projects/%s/client/%s_%d.%s",
        projectId, clientUid, System.currentTimeMillis(), ext);

    Bucket bucket = StorageClient.getInstance().bucket();
    Blob blob = bucket.create(blobPath, file.getBytes(),
        Optional.ofNullable(file.getContentType()).orElse("application/octet-stream"));

    URL signedUrl = blob.signUrl(7, TimeUnit.DAYS);

    Map<String, Object> meta = new HashMap<>();
    meta.put("fileName", file.getOriginalFilename());
    meta.put("contentType", file.getContentType());
    meta.put("createdAt", new Date());
    meta.put("uploaderUid", clientUid);
    meta.put("roleAtUpload", "client");
    meta.put("statut", "en_attente");
    meta.put("storagePath", blobPath);
    meta.put("url", signedUrl != null ? signedUrl.toString() : null);

    DocumentReference ref = db().collection("projects").document(projectId)
        .collection("documents").document();
    ref.set(meta).get();

    meta.put("id", ref.getId());
    return meta;
  }

  /* =================== CRENEAUX & RDV =================== */

  public List<Map<String, Object>> getAvailableSlots(String consultanteUid, String from, String to) throws Exception {
    CollectionReference coll = db()
        .collection("plannings")
        .document(consultanteUid)
        .collection("creneaux");

    try {
      Query q = coll
          .whereGreaterThanOrEqualTo("jour", from)
          .whereLessThanOrEqualTo("jour", to)
          .whereEqualTo("statut", "disponible")
          .orderBy("jour")
          .orderBy("heureDebut");
      List<QueryDocumentSnapshot> docs = q.get().get().getDocuments();

      List<Map<String, Object>> out = new ArrayList<>();
      for (QueryDocumentSnapshot d : docs) {
        Map<String, Object> m = d.getData();
        m.put("id", d.getId());
        out.add(m);
      }
      return out;
    } catch (Exception needsIndex) {
      Query q = coll
          .whereGreaterThanOrEqualTo("jour", from)
          .whereLessThanOrEqualTo("jour", to)
          .orderBy("jour");

      List<QueryDocumentSnapshot> docs = q.get().get().getDocuments();

      List<Map<String, Object>> out = new ArrayList<>();
      for (QueryDocumentSnapshot d : docs) {
        Map<String, Object> m = d.getData();
        String statut = String.valueOf(m.getOrDefault("statut", ""));
        if (!"disponible".equalsIgnoreCase(statut)) continue;
        m.put("id", d.getId());
        out.add(m);
      }

      out.sort((a, b) -> {
        int c = String.valueOf(a.get("jour")).compareTo(String.valueOf(b.get("jour")));
        if (c != 0) return c;
        return String.valueOf(a.get("heureDebut")).compareTo(String.valueOf(b.get("heureDebut")));
      });

      return out;
    }
  }

 // in ClientService.java
public Map<String, Object> bookRendezVous(String clientUid, Map<String, Object> body) throws Exception {
  String consultanteUid = Objects.toString(body.get("consultanteUid"), "");
  String projectId      = Objects.toString(body.get("projetId"), "");
  String creneauId      = Objects.toString(body.get("creneauId"), "");
  String heureDebut     = Objects.toString(body.get("heureDebut"), "");
  String heureFin       = Objects.toString(body.get("heureFin"), "");

  if (consultanteUid.isEmpty() || projectId.isEmpty() || creneauId.isEmpty()) {
    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Champs manquants");
  }

  DocumentReference slotRef = db()
      .collection("plannings").document(consultanteUid)
      .collection("creneaux").document(creneauId);

  // Vérifs hors transaction
  DocumentSnapshot slot = slotRef.get().get();
  if (!slot.exists()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Créneau introuvable");

  String jour      = slot.getString("jour");
  String slotStart = slot.getString("heureDebut");
  String slotEnd   = slot.getString("heureFin");

  String start = (heureDebut == null || heureDebut.isBlank()) ? slotStart : heureDebut;
  String end   = (heureFin   == null || heureFin.isBlank())   ? slotEnd   : heureFin;

  if (!(start.compareTo(end) < 0))
    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Heures invalides");
  if (start.compareTo(slotStart) < 0 || end.compareTo(slotEnd) > 0)
    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Sous-plage hors créneau");

  Map<String, Object> created = db().runTransaction(t -> {
    // ✅ IMPORTANT : t.get(...) -> .get() pour obtenir le DocumentSnapshot
    DocumentSnapshot s = t.get(slotRef).get();

    if (!"disponible".equalsIgnoreCase(s.getString("statut"))) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "Créneau pris");
    }

    // Pour l’instant on bloque le créneau complet en "reserve".
    t.update(slotRef, Map.of("statut", "reserve"));

    DocumentReference rdvRef = db().collection("rendezvous").document();
    Map<String, Object> rdv = new HashMap<>();
    rdv.put("id", rdvRef.getId());
    rdv.put("clientUid", clientUid);
    rdv.put("consultanteUid", consultanteUid);
    rdv.put("projetId", projectId);
    rdv.put("date", jour);
    rdv.put("heureDebut", start);
    rdv.put("heureFin", end);
    rdv.put("type", "consultation");
    rdv.put("statut", "planifie");
    rdv.put("createdAt", new Date());

    t.set(rdvRef, rdv);
    return rdv;
  }).get();

  Map<String, Object> result = new HashMap<>();
  result.put("id", created.get("id"));
  result.put("date", jour);
  result.put("heureDebut", start);
  result.put("heureFin", end);
  result.put("statut", "planifie");
  result.put("projetId", projectId);
  result.put("consultanteUid", consultanteUid);
  return result;
}



  public List<Map<String, Object>> getMyAppointments(String clientUid, String from, String to) throws Exception {
    CollectionReference coll = db().collection("rendezvous");
    Query q = coll.whereEqualTo("clientUid", clientUid);
    if (from != null && !from.isBlank()) q = q.whereGreaterThanOrEqualTo("date", from);
    if (to   != null && !to.isBlank())   q = q.whereLessThanOrEqualTo("date", to);
    q = q.orderBy("date");

    List<QueryDocumentSnapshot> docs;
    try {
      docs = q.get().get().getDocuments();
    } catch (Exception e) {
      docs = coll.whereEqualTo("clientUid", clientUid).get().get().getDocuments();
    }

    List<Map<String, Object>> out = new ArrayList<>();
    for (QueryDocumentSnapshot d : docs) {
      Map<String, Object> m = d.getData();
      m.put("id", d.getId());
      out.add(m);
    }
    out.sort((a, b) -> {
      int c = String.valueOf(a.get("date")).compareTo(String.valueOf(b.get("date")));
      if (c != 0) return c;
      return String.valueOf(a.get("heureDebut")).compareTo(String.valueOf(b.get("heureDebut")));
    });
    return out;
  }

  public Map<String, Object> getMyProjectById(String clientUid, String projectId) throws Exception {
    DocumentSnapshot d = db().collection("projects").document(projectId).get().get();
    if (!d.exists()) return null;
    Map<String, Object> m = d.getData();
    if (m == null) return null;
    String owner = Objects.toString(m.get("clientUid"), "");
    if (!clientUid.equals(owner)) return null;
    m.put("id", d.getId());
    return m;
  }

  /* =================== Helpers "client" =================== */

  public Map<String, Object> getClientByUid(String uid) throws Exception {
    if (uid == null || uid.isBlank()) return null;
    DocumentSnapshot d = db().collection("users").document(uid).get().get();
    if (!d.exists()) return null;
    Map<String, Object> m = d.getData();
    if (m == null) m = new HashMap<>();
    m.put("uid", d.getId());
    return m;
  }

  public String getClientDisplayName(String uid) throws Exception {
    Map<String, Object> u = getClientByUid(uid);
    if (u == null) return uid != null ? uid : "";
    String nom = Objects.toString(u.get("nom"), "").trim();
    String prenom = Objects.toString(u.get("prenom"), "").trim();
    String email = Objects.toString(u.get("email"), "").trim();
    String full = (nom + " " + prenom).trim();
    if (!full.isBlank()) return full;
    if (!email.isBlank()) return email;
    return Objects.toString(u.get("uid"), uid);
  }
}
