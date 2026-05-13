package com.bankadvisr.backend.dto.rdv;

import lombok.*;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class CreneauDTO {
  private String id;
  private String consultanteUid;
  private String jour;        // YYYY-MM-DD
  private String heureDebut;  // HH:mm
  private String heureFin;    // HH:mm
  private String statut;      // disponible | reserve | indisponible
}
