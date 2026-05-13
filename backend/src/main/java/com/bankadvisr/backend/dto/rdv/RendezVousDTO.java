package com.bankadvisr.backend.dto.rdv;

import lombok.*;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class RendezVousDTO {
  private String id;
  private String projetId;
  private String clientUid;
  private String consultanteUid;
  private String date;        // YYYY-MM-DD
  private String heureDebut;  // HH:mm
  private String heureFin;    // HH:mm
  private String type;        // visio | appel | presentiel (optionnel)

  // Nouveaux statuts harmonisés:
  // en_attente  → créé par client, en attente de validation
  // confirme    → validé par consultante/admin (bloque les conflits)
  // annule      → annulé
  // termine     → terminé (post-rendez-vous)
  private String statut;

  private String lienVisio;   // nullable
  private String clientNom;   // pour l’affichage (optionnel)
}
