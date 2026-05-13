package com.bankadvisr.backend.controller;

import com.bankadvisr.backend.dto.rdv.*;
import com.bankadvisr.backend.service.rdv.PlanningService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@CrossOrigin(origins = {"http://localhost:3000","http://localhost:5173"})
@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminPlanningController {

  private final PlanningService planning;

  @GetMapping("/creneaux-disponibles")
  public List<CreneauDTO> getDisponibles(@RequestParam String consultanteId,
                                         @RequestParam String from,
                                         @RequestParam String to) throws Exception {
    return planning.findDisponibles(consultanteId, from, to);
  }

  @PostMapping("/planning/{consultanteUid}/creneaux")
  public CreneauDTO create(@PathVariable String consultanteUid,
                           @RequestBody CreneauDTO dto) throws Exception {
    dto.setConsultanteUid(consultanteUid);
    return planning.createCreneau(consultanteUid, dto);
  }

  @PostMapping("/planning/{consultanteUid}/creneaux:bulk")
  public List<CreneauDTO> bulk(@PathVariable String consultanteUid,
                               @RequestBody BulkCreneauxRequest req) throws Exception {
    return planning.bulkGenerate(consultanteUid, req);
  }

  @PatchMapping("/planning/{consultanteUid}/creneaux/{id}")
  public ResponseEntity<Void> patch(@PathVariable String consultanteUid,
                                    @PathVariable String id,
                                    @RequestParam String statut) throws Exception {
    planning.updateCreneauStatut(consultanteUid, id, statut);
    return ResponseEntity.noContent().build();
  }

  @DeleteMapping("/planning/{consultanteUid}/creneaux/{id}")
  public ResponseEntity<Void> delete(@PathVariable String consultanteUid,
                                     @PathVariable String id) throws Exception {
    planning.deleteCreneau(consultanteUid, id);
    return ResponseEntity.noContent().build();
  }
  @GetMapping("/planning/{consultanteUid}/creneaux")
public List<CreneauDTO> getAll(@PathVariable String consultanteUid,
                               @RequestParam String from,
                               @RequestParam String to) throws Exception {
  return planning.findRange(consultanteUid, from, to);
  
}
public List<CreneauDTO> getRange(@PathVariable String consultanteUid,
                                 @RequestParam String from,
                                 @RequestParam String to) throws Exception {
  return planning.findRange(consultanteUid, from, to);
}
}