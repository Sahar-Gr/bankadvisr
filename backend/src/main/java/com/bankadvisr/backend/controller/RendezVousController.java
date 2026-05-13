package com.bankadvisr.backend.controller;

import com.bankadvisr.backend.dto.rdv.CreateRdvRequest;
import com.bankadvisr.backend.dto.rdv.RendezVousDTO;
import com.bankadvisr.backend.service.ClientService;
import com.bankadvisr.backend.service.rdv.RendezVousService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@CrossOrigin(origins = {"http://localhost:3000", "http://localhost:5173"})
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class RendezVousController {

  private final RendezVousService service;
  private final ClientService clientService;

  // ====== GET /api/rendezvous (historique: un jour + rôle) ======
  @GetMapping(value = "/rendezvous", params = {"date", "role"})
  public List<RendezVousDTO> byDate(
      @RequestParam String date,
      @RequestParam String role,
      HttpServletRequest req
  ) throws Exception {
    String uid = (String) req.getAttribute("uid");
    List<RendezVousDTO> list = service.getByDateForRole(date, role, uid);
    fillClientNames(list);
    return list;
  }

  // ====== GET /api/rendezvous (consultanteId + from + to) ======
  @GetMapping(value = "/rendezvous", params = {"consultanteId", "from", "to"})
  public List<RendezVousDTO> byConsultanteAndRange(
      @RequestParam String consultanteId,
      @RequestParam String from,
      @RequestParam String to
  ) throws Exception {
    LocalDate start = LocalDate.parse(from);
    LocalDate end = LocalDate.parse(to);

    List<RendezVousDTO> all = new ArrayList<>();
    for (LocalDate d = start; !d.isAfter(end); d = d.plusDays(1)) {
      List<RendezVousDTO> day = service.getByDateForRole(d.toString(), "consultante", consultanteId);
      if (day != null && !day.isEmpty()) all.addAll(day);
    }

    Map<String, RendezVousDTO> byId = all.stream()
        .filter(Objects::nonNull)
        .collect(Collectors.toMap(
            RendezVousDTO::getId, x -> x, (a, b) -> a, LinkedHashMap::new
        ));
    List<RendezVousDTO> list = new ArrayList<>(byId.values());
    fillClientNames(list);
    return list;
  }

  // ====== POST /api/rendezvous ======
  // Rappel: le service décidera du statut initial selon le rôle:
  // - role == "client"      → en_attente
  // - role == "consultante" → confirme
  // - role == "admin"       → confirme
  @PostMapping("/rendezvous")
  public RendezVousDTO reserver(
      @RequestBody CreateRdvRequest body,
      HttpServletRequest req
  ) throws Exception {
    String uid = (String) req.getAttribute("uid");
    String role = (String) req.getAttribute("role");

    RendezVousDTO dto = service.reserver(body, uid, role);

    if (dto != null && (dto.getClientNom() == null || dto.getClientNom().isBlank())) {
      String full = clientService.getClientDisplayName(dto.getClientUid());
      if (full != null && !full.isBlank()) dto.setClientNom(full);
    }
    return dto;
  }

  // ====== PATCH /api/rendezvous/{id}?statut=... ======
  @PatchMapping("/rendezvous/{id}")
  public ResponseEntity<Void> updateStatut(@PathVariable String id,
                                           @RequestParam String statut) throws Exception {
    final String s = statut == null ? "" : statut.toLowerCase(Locale.ROOT).trim();
    // Statuts acceptés
    if (!List.of("en_attente", "confirme", "annule", "termine").contains(s)) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Statut invalide");
    }
    // La règle de collision est appliquée côté service quand on passe à "confirme"
    service.updateStatut(id, s);
    return ResponseEntity.noContent().build();
  }

  @DeleteMapping("/rendezvous/{id}")
  public ResponseEntity<Void> delete(@PathVariable String id) throws Exception {
    service.delete(id);
    return ResponseEntity.noContent().build();
  }

  @PostMapping("/visio/{rendezvousId}/start")
  public ResponseEntity<String> startVisio(@PathVariable String rendezvousId) throws Exception {
    String url = service.startVisio(rendezvousId);
    return ResponseEntity.ok(url);
  }

  @GetMapping(value = "/rendezvous/{id}/ics", produces = "text/calendar")
  public ResponseEntity<byte[]> ics(@PathVariable String id) throws Exception {
    String ics = service.generateICS(id);
    return ResponseEntity.ok()
        .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"rdv-" + id + ".ics\"")
        .contentType(MediaType.parseMediaType("text/calendar; charset=utf-8"))
        .body(ics.getBytes(StandardCharsets.UTF_8));
  }

  // ====== Helper privé ======
  private void fillClientNames(List<RendezVousDTO> list) {
    if (list == null) return;
    for (RendezVousDTO dto : list) {
      if (dto == null) continue;
      if (dto.getClientNom() != null && !dto.getClientNom().isBlank()) continue;
      try {
        String full = clientService.getClientDisplayName(dto.getClientUid());
        if (full != null && !full.isBlank()) dto.setClientNom(full);
      } catch (Exception ignored) {
      }
    }
  }
}
