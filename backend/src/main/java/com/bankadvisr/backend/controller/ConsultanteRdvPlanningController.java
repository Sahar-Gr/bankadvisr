package com.bankadvisr.backend.controller;

import com.bankadvisr.backend.dto.rdv.*;
import com.bankadvisr.backend.service.rdv.RendezVousService;
import com.bankadvisr.backend.service.rdv.PlanningService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
@RequestMapping("/api/consultante")
@CrossOrigin(origins = "http://localhost:3000")
public class ConsultanteRdvPlanningController {

  private final RendezVousService rendezVousService;
  private final PlanningService planningService;

  public ConsultanteRdvPlanningController(RendezVousService r, PlanningService p) {
    this.rendezVousService = r; this.planningService = p;
  }

  @GetMapping("/rendezvous")
  public ResponseEntity<List<RendezVousDTO>> byDate(@RequestHeader("X-Demo-Uid") String uid,
                                                    @RequestParam(required=false) String date) throws Exception {
    String day = (date==null || date.isBlank()) ? java.time.LocalDate.now().toString() : date;
    return ResponseEntity.ok(rendezVousService.getByDateForRole(day, "consultante", uid));
  }

  @PostMapping("/rendezvous")
  public ResponseEntity<RendezVousDTO> create(@RequestHeader("X-Demo-Uid") String uid,
                                              @RequestBody CreateRdvRequest req) throws Exception {
    return ResponseEntity.ok(rendezVousService.reserver(req, uid, "consultante"));
  }

  @GetMapping("/planning")
  public ResponseEntity<List<CreneauDTO>> planning(@RequestHeader("X-Demo-Uid") String uid,
                                                   @RequestParam(required=false) String from,
                                                   @RequestParam(required=false) String to) throws Exception {
    if (from!=null && to!=null) return ResponseEntity.ok(planningService.findRange(uid, from, to));
    return ResponseEntity.ok(planningService.findDisponibles(uid, null, null));
  }

  @PostMapping("/planning/slots")
  public ResponseEntity<CreneauDTO> createSlot(@RequestHeader("X-Demo-Uid") String uid,
                                               @RequestBody CreneauDTO dto) throws Exception {
    return ResponseEntity.ok(planningService.createCreneau(uid, dto));
  }
}
