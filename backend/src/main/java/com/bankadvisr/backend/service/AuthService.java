package com.bankadvisr.backend.service;

import com.bankadvisr.backend.dto.LoginResponse;
import com.bankadvisr.backend.util.JwtUtil;
import com.google.cloud.firestore.DocumentSnapshot;
import com.google.cloud.firestore.Firestore;
import com.google.firebase.cloud.FirestoreClient;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.Map;

@Service
public class AuthService {

    private final String FIREBASE_API_KEY = "AIzaSyDdjGVkMnAhbaTY2MLbUZrfkq_X7GBkCkU"; // 🔐 À sécuriser plus tard

    public LoginResponse authenticateUser(String email, String password) throws Exception {
        String url = "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=" + FIREBASE_API_KEY;

        RestTemplate restTemplate = new RestTemplate();

        Map<String, Object> payload = new HashMap<>();
        payload.put("email", email);
        payload.put("password", password);
        payload.put("returnSecureToken", true);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        HttpEntity<Map<String, Object>> request = new HttpEntity<>(payload, headers);

        try {
            ResponseEntity<Map> response = restTemplate.postForEntity(url, request, Map.class);

            if (response.getStatusCode() == HttpStatus.OK) {
                Map<String, Object> body = response.getBody();
                String uid = (String) body.get("localId");

                // 🔍 Récupérer rôle + statut depuis Firestore
                Firestore db = FirestoreClient.getFirestore();
                DocumentSnapshot doc = db.collection("users").document(uid).get().get();

                if (!doc.exists()) {
                    throw new RuntimeException("Utilisateur introuvable dans Firestore.");
                }

                String role = doc.getString("role");
                Boolean active = doc.getBoolean("active");

                if (active != null && !active) {
                    throw new RuntimeException("Compte désactivé.");
                }

                // ✅ Générer le JWT
                String jwt = JwtUtil.generateToken(uid, role);

                // ⏎ Retour avec JWT dans le message
                return new LoginResponse(uid, role, jwt);

            } else {
                throw new RuntimeException("Échec de la connexion Firebase");
            }

        } catch (Exception e) {
            throw new RuntimeException("Identifiants invalides ou erreur Firebase : " + e.getMessage());
        }
    }
}
