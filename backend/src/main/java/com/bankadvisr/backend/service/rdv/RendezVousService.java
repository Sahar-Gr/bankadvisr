package com.bankadvisr.backend.service.rdv;

import com.bankadvisr.backend.dto.rdv.*;
import java.util.List;

public interface RendezVousService {
  List<RendezVousDTO> getByDateForRole(String date, String role, String uid) throws Exception;
  RendezVousDTO reserver(CreateRdvRequest req, String actorUid, String actorRole) throws Exception;
  void updateStatut(String rdvId, String statut) throws Exception;
  void delete(String rdvId) throws Exception;
  String startVisio(String rdvId) throws Exception;
  String generateICS(String rdvId) throws Exception;
}
