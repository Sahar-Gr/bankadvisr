package com.bankadvisr.backend.dto.rdv;

import lombok.Data;

@Data
public class CreateRdvRequest {
  private String projetId;
  private String clientUid;
  private String consultanteUid;
  private String creneauId;    // id d'un créneau "disponible"
  private String heureDebut;   // ex "10:30"
  private String heureFin;     // ex "11:50"
}
