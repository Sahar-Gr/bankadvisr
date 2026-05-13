package com.bankadvisr.backend.service.rdv.impl;

import com.bankadvisr.backend.dto.rdv.*;
import com.bankadvisr.backend.service.rdv.PlanningService;

import java.util.Collections;
import java.util.List;

// PAS d'annotations Spring ici
public class PlanningServiceStub implements PlanningService {

  @Override
  public List<CreneauDTO> findDisponibles(String consultanteUid, String from, String to) {
    return Collections.emptyList();
  }

  @Override
  public List<CreneauDTO> findRange(String consultanteUid, String from, String to) {
    // pour les tests unitaires / compilation uniquement
    return Collections.emptyList();
  }

  @Override
  public CreneauDTO createCreneau(String consultanteUid, CreneauDTO dto) {
    throw new UnsupportedOperationException("PlanningService.createCreneau non implémenté");
  }

  @Override
  public void updateCreneauStatut(String consultanteUid, String creneauId, String statut) {
    throw new UnsupportedOperationException("PlanningService.updateCreneauStatut non implémenté");
  }

  @Override
  public void deleteCreneau(String consultanteUid, String creneauId) {
    throw new UnsupportedOperationException("PlanningService.deleteCreneau non implémenté");
  }

  @Override
  public List<CreneauDTO> bulkGenerate(String consultanteUid, BulkCreneauxRequest req) {
    return Collections.emptyList();
  }
}
