package com.bankadvisr.backend.service;

import com.bankadvisr.backend.dto.ConsultanteDTO;
import com.google.api.core.ApiFuture;
import com.google.cloud.firestore.*;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.UserRecord;
import com.google.firebase.cloud.FirestoreClient;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.concurrent.ExecutionException;
import java.util.stream.Collectors;

/**
 * Service d'accès Firestore + (optionnel) Firebase Auth pour la gestion des clients.
 * Collection utilisée : "users", document id = uid.
 */
@Service
public class AdminService {

    private Firestore db() {
        return FirestoreClient.getFirestore();
    }

    /** Liste tous les documents "users" ayant role == "client" */
    public List<Map<String, Object>> listClients() throws ExecutionException, InterruptedException {
        ApiFuture<QuerySnapshot> fut = db().collection("users")
                .whereEqualTo("role", "client")
                .get();
        QuerySnapshot snap = fut.get();

        List<Map<String, Object>> out = new ArrayList<>();
        for (DocumentSnapshot d : snap.getDocuments()) {
            Map<String, Object> m = new HashMap<>(d.getData());
            m.put("uid", d.getId());
            out.add(m);
        }
        return out;
    }

    /** Crée (ou remplace) le document users/{uid} */
    public Map<String, Object> createClient(Map<String, Object> body) throws ExecutionException, InterruptedException {
        String uid = (String) body.get("uid");
        if (uid == null || uid.isBlank()) {
            throw new IllegalArgumentException("uid manquant");
        }

        Map<String, Object> data = new HashMap<>();
        data.put("email", body.get("email"));
        data.put("nom", body.get("nom"));
        data.put("prenom", body.get("prenom"));
        data.put("numeroWhatsApp", body.get("numeroWhatsApp"));
        data.put("active", body.getOrDefault("active", true));
        data.put("role", "client");

        db().collection("users").document(uid).set(data).get();

        Map<String, Object> resp = new HashMap<>(data);
        resp.put("uid", uid);
        return resp;
    }

    /** Met à jour partiellement users/{uid} (seulement les champs autorisés) */
    public Map<String, Object> updateClient(String uid, Map<String, Object> updates) throws ExecutionException, InterruptedException {
        if (uid == null || uid.isBlank()) throw new IllegalArgumentException("uid manquant");

        Map<String, Object> allowed = new HashMap<>();
        if (updates.containsKey("nom"))            allowed.put("nom", updates.get("nom"));
        if (updates.containsKey("prenom"))         allowed.put("prenom", updates.get("prenom"));
        if (updates.containsKey("numeroWhatsApp")) allowed.put("numeroWhatsApp", updates.get("numeroWhatsApp"));
        if (updates.containsKey("active"))         allowed.put("active", updates.get("active"));
        if (updates.containsKey("email"))          allowed.put("email", updates.get("email"));

        if (allowed.isEmpty()) {
            throw new IllegalArgumentException("Aucun champ à mettre à jour");
        }

        // Update partielle
        db().collection("users").document(uid).update(allowed).get();

        // Retourner le document à jour
        DocumentSnapshot doc = db().collection("users").document(uid).get().get();
        if (!doc.exists()) throw new IllegalStateException("Le client n'existe pas");
        Map<String, Object> resp = new HashMap<>(doc.getData());
        resp.put("uid", uid);
        return resp;
    }

    /** Supprime le doc users/{uid} (V0 : sans supprimer l'utilisateur Firebase Auth) */
    public void deleteClient(String uid) throws ExecutionException, InterruptedException {
        db().collection("users").document(uid).delete().get();
        // Optionnel plus tard : supprimer aussi dans Firebase Auth :
        // FirebaseAuth.getInstance().deleteUser(uid);
    }

    /** Active/Désactive le client (champ "active") */
    public void toggleClientActive(String uid, boolean active) throws ExecutionException, InterruptedException {
        db().collection("users").document(uid).update("active", active).get();
    }

    /** (Optionnel) Lookup UID par email via Admin SDK (utile si l’email existe déjà) */
    public Map<String, String> lookupUserByEmail(String email) throws Exception {
        UserRecord user = FirebaseAuth.getInstance().getUserByEmail(email);
        return Map.of("uid", user.getUid(), "email", user.getEmail());
    }

    /** (Optionnel) Met à jour l’email dans Firebase Auth aussi (si tu veux garder les deux en phase) */
    public void updateAuthEmail(String uid, String newEmail) throws Exception {
        UserRecord.UpdateRequest req = new UserRecord.UpdateRequest(uid).setEmail(newEmail);
        FirebaseAuth.getInstance().updateUser(req);
    }
     public List<Map<String,Object>> listConsultantes() throws Exception {
    CollectionReference users = db().collection("users");

    // whereEqualTo("role","consultante")
    List<QueryDocumentSnapshot> docs = users
        .whereEqualTo("role", "consultante")
        .get().get().getDocuments();

    return docs.stream()
        // si "active" absent -> on considère actif
        .filter(d -> {
          Boolean active = d.getBoolean("active");
          return active == null || active.booleanValue();
        })
        .map(d -> {
          Map<String,Object> m = new HashMap<>();
          m.put("uid", d.getId());
          m.put("nom", d.getString("nom"));
          m.put("prenom", d.getString("prenom"));
          m.put("email", d.getString("email"));
          m.put("active", d.getBoolean("active"));
          return m;
        })
        .sorted(Comparator
          .comparing((Map<String,Object> m) -> Optional.ofNullable((String)m.get("nom")).orElse(""))
          .thenComparing(m -> Optional.ofNullable((String)m.get("prenom")).orElse("")))
        .collect(Collectors.toList());
  }
 
}
