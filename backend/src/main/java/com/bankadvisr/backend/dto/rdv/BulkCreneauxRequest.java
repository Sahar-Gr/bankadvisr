package com.bankadvisr.backend.dto.rdv;

import lombok.Data;
import java.util.List;

@Data
public class BulkCreneauxRequest {
  // Période (inclusif) au format yyyy-MM-dd
  private String from;            // ex: "2025-08-18"
  private String to;              // ex: "2025-09-30"

  // 1 = Lundi ... 7 = Dimanche (par défaut Lun-Ven)
  private List<Integer> daysOfWeek;

  // Durée d’un créneau en minutes (60 par défaut)
  private int slotMinutes = 60;

  // Fenêtres d’ouverture (on saute la pause midi)
  private String morningStart   = "09:00";
  private String morningEnd     = "12:00";
  private String afternoonStart = "14:00";
  private String afternoonEnd   = "16:00";

  // Statut créé
  private String statut = "disponible";
}
