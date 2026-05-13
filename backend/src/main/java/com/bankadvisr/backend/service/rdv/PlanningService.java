package com.bankadvisr.backend.service.rdv;

import com.bankadvisr.backend.dto.rdv.*;
import java.util.List;

public interface PlanningService {
  List<CreneauDTO> findDisponibles(String consultanteUid, String from, String to) throws Exception;
  CreneauDTO createCreneau(String consultanteUid, CreneauDTO dto) throws Exception;
  void updateCreneauStatut(String consultanteUid, String creneauId, String statut) throws Exception;
  void deleteCreneau(String consultanteUid, String creneauId) throws Exception;
  List<CreneauDTO> bulkGenerate(String consultanteUid, BulkCreneauxRequest req) throws Exception;
  List<CreneauDTO> findRange(String consultanteUid, String from, String to) throws Exception;


}
