package com.bankadvisr.backend.service.rdv.impl;

import com.bankadvisr.backend.dto.rdv.*;
import com.bankadvisr.backend.service.rdv.RendezVousService;


import java.util.Collections;
import java.util.List;

public class RendezVousServiceStub implements RendezVousService {

  @Override
  public List<RendezVousDTO> getByDateForRole(String date, String role, String uid) {
    return Collections.emptyList();
  }

  @Override
  public RendezVousDTO reserver(CreateRdvRequest req, String actorUid, String actorRole) {
    throw new UnsupportedOperationException("RendezVousService.reserver non implémenté");
  }

  @Override
  public void updateStatut(String rdvId, String statut) {
    throw new UnsupportedOperationException("RendezVousService.updateStatut non implémenté");
  }

  @Override
  public void delete(String rdvId) {
    throw new UnsupportedOperationException("RendezVousService.delete non implémenté");
  }

  @Override
  public String startVisio(String rdvId) {
    // Jitsi simple par défaut
    return "https://meet.jit.si/consulting-" + rdvId;
  }

  @Override
  public String generateICS(String rdvId) {
    throw new UnsupportedOperationException("RendezVousService.generateICS non implémenté");
  }
}
