package com.bankadvisr.backend.service;

import com.bankadvisr.backend.dto.DocumentDTO;
import com.bankadvisr.backend.storage.ObjectStorage;
import com.bankadvisr.backend.storage.StoredFile;
import com.google.cloud.Timestamp;
import com.google.cloud.firestore.*;
import com.google.firebase.cloud.FirestoreClient;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.util.*;
import java.util.concurrent.ExecutionException;

@Service
@RequiredArgsConstructor
public class DocumentService {

    private final ObjectStorage storage;

    private static final long MAX_BYTES = 10L * 1024 * 1024; // 10 Mo
    private static final Set<String> ALLOWED_MIME = Set.of(
            "application/pdf",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // DOCX
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"        // XLSX
    );
    private static final Set<String> ALLOWED_EXT = Set.of("pdf", "docx", "xlsx");

    private DocumentReference projectRef(Firestore db, String projectId) {
        return db.collection("projects").document(projectId);
    }

    private static String extOf(String filename) {
        if (filename == null) return "";
        int i = filename.lastIndexOf('.');
        return (i >= 0 && i < filename.length() - 1) ? filename.substring(i + 1).toLowerCase() : "";
    }

    private void validateFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Fichier vide.");
        }
        if (file.getSize() > MAX_BYTES) {
            throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, "Fichier trop volumineux (10 Mo max).");
        }

        String ct = Optional.ofNullable(file.getContentType()).orElse("").toLowerCase();
        String ext = extOf(file.getOriginalFilename());

        boolean mimeOk = ALLOWED_MIME.contains(ct);
        boolean extOk  = ALLOWED_EXT.contains(ext);

        if (!(mimeOk || extOk)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Format non autorisé. Formats acceptés : PDF, DOCX, XLSX."
            );
        }
    }

    public DocumentDTO upload(String projectId, MultipartFile file,
                              String uid, String role, boolean treated) throws Exception {
        Firestore db = FirestoreClient.getFirestore();

        DocumentSnapshot proj = projectRef(db, projectId).get().get();
        if (!proj.exists()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Projet introuvable.");
        
        String statut = proj.getString("statutGlobal");
        if ("termine".equalsIgnoreCase(statut) || "terminé".equalsIgnoreCase(statut))
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Projet clôturé.");

        validateFile(file);
        StoredFile sf = storage.save(projectId, file);

        final String docStatut = "valide";

        Map<String, Object> data = new HashMap<>();
        data.put("fileName", sf.getOriginalName());
        data.put("contentType", sf.getContentType());
        data.put("size", sf.getSize());
        data.put("statut", docStatut);
        data.put("storagePath", sf.getStoragePath());
        data.put("uploadedByUid", uid);
        data.put("roleAtUpload", role);
        data.put("createdAt", FieldValue.serverTimestamp());

        DocumentReference docRef = projectRef(db, projectId).collection("documents").document();
        docRef.set(data).get();

        return DocumentDTO.builder()
                .id(docRef.getId())
                .name(sf.getOriginalName())
                .contentType(sf.getContentType())
                .size(sf.getSize())
                .status(docStatut)
                .storagePath(sf.getStoragePath())
                .uploadedBy(uid)
                .uploadedByRole(role)
                .createdAt(System.currentTimeMillis())
                .build();
    }

    public List<DocumentDTO> list(String projectId) throws ExecutionException, InterruptedException {
        Firestore db = FirestoreClient.getFirestore();
        QuerySnapshot qs = projectRef(db, projectId)
                .collection("documents")
                .orderBy("createdAt", Query.Direction.DESCENDING)
                .get().get();

        List<DocumentDTO> out = new ArrayList<>();
        for (DocumentSnapshot d : qs.getDocuments()) {
            Timestamp ts = d.getTimestamp("createdAt");
            long createdAt = (ts != null) ? ts.toDate().getTime() : 0L;

            out.add(DocumentDTO.builder()
                    .id(d.getId())
                    .name(d.getString("fileName"))
                    .contentType(d.getString("contentType"))
                    .size(d.getLong("size") == null ? 0 : d.getLong("size"))
                    .status(d.getString("statut"))
                    .storagePath(d.getString("storagePath"))
                    .uploadedBy(d.getString("uploadedByUid"))
                    .uploadedByRole(d.getString("roleAtUpload"))
                    .createdAt(createdAt)
                    .build());
        }
        return out;
    }

    public Resource download(String projectId, String docId) throws Exception {
        Firestore db = FirestoreClient.getFirestore();
        DocumentSnapshot snap = projectRef(db, projectId)
                .collection("documents").document(docId).get().get();
        if (!snap.exists()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Document introuvable.");
        String storagePath = snap.getString("storagePath");
        return storage.loadAsResource(storagePath);
    }

    public String getOriginalFilename(String projectId, String docId) throws Exception {
        Firestore db = FirestoreClient.getFirestore();
        DocumentSnapshot snap = projectRef(db, projectId)
                .collection("documents").document(docId).get().get();
        if (!snap.exists()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Document introuvable.");
        return Optional.ofNullable(snap.getString("fileName")).orElse(docId);
    }

    public void delete(String projectId, String docId, String requestUid, String role) throws Exception {
        Firestore db = FirestoreClient.getFirestore();
        DocumentReference ref = projectRef(db, projectId).collection("documents").document(docId);
        DocumentSnapshot snap = ref.get().get();
        
        if (!snap.exists()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Document introuvable.");
        }

        // 🔒 SÉCURITÉ : Debug et vérification des droits
        String ownerUid = snap.getString("uploadedByUid");
        boolean isAdmin = "admin".equalsIgnoreCase(role);
        boolean isOwner = (requestUid != null && requestUid.equals(ownerUid));

        // LOG POUR DEBUGGER SI CA ÉCHOUE
        System.out.println("Tentative de suppression - Demandeur: " + requestUid + " Role: " + role);
        System.out.println("Propriétaire du doc: " + ownerUid + " IsAdmin: " + isAdmin + " IsOwner: " + isOwner);

        if (!isAdmin && !isOwner) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Droit de suppression refusé.");
        }

        // 1. Suppression physique (Appel à ton interface ObjectStorage)
        String storagePath = snap.getString("storagePath");
        if (storagePath != null && !storagePath.isBlank()) {
            try {
                storage.delete(storagePath);
                System.out.println("✅ Fichier physique supprimé : " + storagePath);
            } catch (Exception e) {
                System.err.println("❌ Erreur suppression physique (on continue) : " + e.getMessage());
            }
        }

        // 2. Suppression Firestore
        ref.delete().get();
        System.out.println("✅ Métadonnées Firestore supprimées.");
    }

    public void updateStatus(String projectId, String docId, String newStatus) throws Exception {
        String ns = Optional.ofNullable(newStatus).orElse("").toLowerCase(Locale.ROOT);
        if (!Set.of("en_attente", "valide", "rejete").contains(ns)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Statut document invalide.");
        }
        Firestore db = FirestoreClient.getFirestore();
        DocumentReference ref = projectRef(db, projectId).collection("documents").document(docId);
        if (!ref.get().get().exists()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Document introuvable.");
        }
        ref.update("statut", ns).get();
    }

    public String getContentType(String projectId, String docId) throws Exception {
        Firestore db = FirestoreClient.getFirestore();
        DocumentSnapshot snap = db.collection("projects").document(projectId)
                .collection("documents").document(docId).get().get();
        if (!snap.exists()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Document introuvable.");
        return snap.getString("contentType");
    }
}