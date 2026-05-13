package com.bankadvisr.backend.service;

import com.bankadvisr.backend.dto.ProjectCreateRequest;
import com.google.cloud.firestore.*;
import com.google.firebase.cloud.FirestoreClient;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.*;
import java.util.concurrent.ExecutionException;
import java.util.stream.Collectors;

@Service
public class ProjectService {

    private Firestore db() {
        return FirestoreClient.getFirestore();
    }

    
    private void deletePhysicalFile(String filePath) {
        if (filePath == null || filePath.isBlank()) return;
        try {
            Path path = Paths.get(filePath);
            Files.deleteIfExists(path);
        } catch (IOException e) {
            System.err.println("Erreur suppression fichier : " + e.getMessage());
        }
    }

    // ---------- CREATE ----------
    public Map<String, Object> createProject(ProjectCreateRequest body) throws ExecutionException, InterruptedException {
        String clientUid = body.getClientUid() == null ? "" : body.getClientUid().trim();
        String consultanteUid = body.getConsultanteUid();
        String titre = body.getTitre() == null ? "" : body.getTitre().trim();
        String description = body.getDescription() == null ? "" : body.getDescription().trim();

        if (clientUid.isBlank() || titre.isBlank() || description.isBlank()) 
            throw new IllegalArgumentException("Champs obligatoires manquants");

        Map<String, Object> data = new HashMap<>();
        data.put("clientUid", clientUid);
        data.put("consultanteUid", (consultanteUid == null || consultanteUid.isBlank()) ? null : consultanteUid.trim());
        data.put("titre", titre);
        data.put("description", description);
        data.put("statutGlobal", "en_cours");
        data.put("avancement", 0);
        data.put("createdAt", FieldValue.serverTimestamp());

        DocumentReference ref = db().collection("projects").document();
        ref.set(data).get();

        DocumentSnapshot snap = ref.get().get();
        Map<String, Object> resp = new HashMap<>(Objects.requireNonNull(snap.getData()));
        resp.put("id", ref.getId());
        normalizeCreatedAt(resp);
        return resp;
    }

    // ---------- LIST ----------
    public List<Map<String, Object>> listProjects(String clientUid) throws ExecutionException, InterruptedException {
        Query q = db().collection("projects");
        if (clientUid != null && !clientUid.isBlank()) {
            q = q.whereEqualTo("clientUid", clientUid);
        }

        QuerySnapshot snap = q.get().get();
        List<Map<String, Object>> out = new ArrayList<>();
        for (DocumentSnapshot d : snap.getDocuments()) {
            Map<String, Object> m = new HashMap<>(Objects.requireNonNull(d.getData()));
            m.put("id", d.getId());
            normalizeCreatedAt(m);
            out.add(m);
        }
        return out;
    }

    // ---------- PATCH ----------
    public Map<String, Object> patchProject(String id, Map<String, Object> patch) throws ExecutionException, InterruptedException {
        DocumentReference ref = db().collection("projects").document(id);
        if (!ref.get().get().exists()) throw new IllegalArgumentException("Projet introuvable");

        Map<String, Object> allowed = new HashMap<>();
        if (patch.containsKey("avancement")) allowed.put("avancement", patch.get("avancement"));
        if (patch.containsKey("statutGlobal")) allowed.put("statutGlobal", patch.get("statutGlobal"));
        if (patch.containsKey("consultanteUid")) allowed.put("consultanteUid", patch.get("consultanteUid"));
        if (patch.containsKey("titre")) allowed.put("titre", patch.get("titre"));
        if (patch.containsKey("description")) allowed.put("description", patch.get("description"));

        ref.update(allowed).get();
        return getProjectById(id);
    }

    // ---------- GET BY ID ----------
    public Map<String, Object> getProjectById(String id) {
        try {
            DocumentSnapshot d = db().collection("projects").document(id).get().get();
            if (!d.exists()) return null;
            Map<String, Object> m = new HashMap<>(Objects.requireNonNull(d.getData()));
            m.put("id", d.getId());
            normalizeCreatedAt(m);
            return m;
        } catch (Exception e) { return null; }
    }

    // ---------- MÉTHODES RÉINTÉGRÉES (POUR FIXER LES ERREURS) ----------

    // 1. Marquer comme terminé (Utilisé par ConsultanteProjectsController)
    public Map<String, Object> markProjectTermine(String id) throws Exception {
        db().collection("projects").document(id).update("statutGlobal", "termine").get();
        return getProjectById(id);
    }

    // 2. Assigner consultante (Utilisé par ProjectController)
    public int assignConsultanteToClient(String clientUid, String consultanteUid) throws Exception {
        QuerySnapshot snap = db().collection("projects").whereEqualTo("clientUid", clientUid).get().get();
        int count = 0;
        for (DocumentSnapshot doc : snap.getDocuments()) {
            doc.getReference().update("consultanteUid", consultanteUid).get();
            count++;
        }
        return count;
    }

    // 3. Whatsapp Consultante (Utilisé par ClientController)
    public Map<String, Object> getConsultanteWhatsappForProject(String projectId) throws Exception {
        DocumentSnapshot p = db().collection("projects").document(projectId).get().get();
        String cUid = p.getString("consultanteUid");
        if (cUid == null) return Map.of("found", false);

        DocumentSnapshot u = db().collection("users").document(cUid).get().get();
        String raw = u.getString("numeroWhatsApp");
        if (raw == null) return Map.of("found", false);

        return Map.of("found", true, "phoneE164", raw, "display", raw);
    }

    // ---------- LISTE PROJETS PAR CONSULTANTE ----------
    public List<Map<String, Object>> listProjectsForConsultante(String consultanteUid, String clientUid, String statut) throws Exception {
        Query q = db().collection("projects").whereEqualTo("consultanteUid", consultanteUid);
        if (clientUid != null && !clientUid.isBlank()) q = q.whereEqualTo("clientUid", clientUid);

        List<Map<String, Object>> out = new ArrayList<>();
        for (DocumentSnapshot d : q.get().get().getDocuments()) {
            Map<String, Object> m = new HashMap<>(d.getData());
            m.put("id", d.getId());
            if ("in_progress".equals(statut) && "termine".equals(m.get("statutGlobal"))) continue;
            out.add(m);
        }
        return out;
    }

    // ---------- LISTE CLIENTS CONSULTANTE ----------
    public List<Map<String, Object>> listClientsForConsultante(String consultanteUid) throws Exception {
        var projSnap = db().collection("projects").whereEqualTo("consultanteUid", consultanteUid).get().get();
        Map<String, Long> counts = projSnap.getDocuments().stream()
                .collect(Collectors.groupingBy(d -> d.getString("clientUid"), Collectors.counting()));

        List<Map<String, Object>> out = new ArrayList<>();
        for (String clientUid : counts.keySet()) {
            DocumentSnapshot u = db().collection("users").document(clientUid).get().get();
            if (!u.exists()) continue;
            Map<String, Object> m = new HashMap<>();
            m.put("uid", clientUid);
            m.put("nom", u.getString("nom"));
            m.put("prenom", u.getString("prenom"));
            m.put("nbProjets", counts.get(clientUid));
            out.add(m);
        }
        return out;
    }

    private void normalizeCreatedAt(Map<String, Object> m) {
        Object ts = m.get("createdAt");
        if (ts instanceof com.google.cloud.Timestamp t) {
            m.put("createdAt", t.toSqlTimestamp().toInstant().toString());
        }
    }

    public void deleteProject(String id) throws ExecutionException, InterruptedException {
        DocumentReference ref = db().collection("projects").document(id);
        DocumentSnapshot snap = ref.get().get();

        if (snap.exists()) {
            // 1. On tente de supprimer le fichier physique SEULEMENT s'il existe
            try {
                // On vérifie si le champ existe et n'est pas null
                if (snap.contains("filePath")) {
                    String filePath = snap.getString("filePath");
                    if (filePath != null && !filePath.isBlank()) {
                        deletePhysicalFile(filePath);
                    }
                }
            } catch (Exception e) {
                // On log l'erreur mais on ne bloque pas la suppression Firestore
                System.out.println("Info: Aucun fichier physique à nettoyer pour le projet " + id);
            }

            // 2. Suppression Firestore
            ref.delete().get();
            System.out.println("✅ Projet supprimé de Firestore : " + id);
        } else {
            throw new IllegalArgumentException("Projet introuvable : " + id);
        }
    }
}