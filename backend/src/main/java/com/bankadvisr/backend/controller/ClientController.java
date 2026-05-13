package com.bankadvisr.backend.controller;

import com.bankadvisr.backend.service.ClientService;
import com.bankadvisr.backend.service.ProjectService;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/client")
@CrossOrigin(origins = "http://localhost:3000")   // 👈 AJOUT
public class ClientController {

  private final ClientService service;
  private final ProjectService projectService;

  public ClientController(ClientService service, ProjectService projectService) {
    this.service = service;
    this.projectService = projectService;
  }

  private String uid(Authentication auth) { return auth.getName(); }

  /* ===== Projets ===== */

  @GetMapping("/projects")
  public ResponseEntity<List<Map<String,Object>>> myProjects(Authentication auth) throws Exception {
    return ResponseEntity.ok(service.getMyProjects(uid(auth)));
  }

  @GetMapping("/projects/{projectId}")
  public ResponseEntity<Map<String,Object>> myProject(Authentication auth, @PathVariable String projectId) throws Exception {
    return ResponseEntity.ok(service.getMyProject(uid(auth), projectId));
  }

  @GetMapping("/projects/{projectId}/documents")
  public ResponseEntity<List<Map<String,Object>>> projectDocs(@PathVariable String projectId) throws Exception {
    return ResponseEntity.ok(service.getProjectDocuments(projectId));
  }

  @PostMapping(path = "/projects/{projectId}/documents", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
  public ResponseEntity<Map<String,Object>> uploadDoc(
      Authentication auth, @PathVariable String projectId, @RequestPart("file") MultipartFile file
  ) throws Exception {
    return ResponseEntity.ok(service.uploadClientDocument(uid(auth), projectId, file));
  }

  /* ===== Consultantes (référentiel) ===== */

  @GetMapping("/consultantes")
  public ResponseEntity<List<Map<String,Object>>> listConsultantes() throws Exception {
    return ResponseEntity.ok(service.listConsultantesLight());
  }

  /* ===== Créneaux & RDV ===== */

  @GetMapping("/creneaux-disponibles")
  public ResponseEntity<List<Map<String,Object>>> slots(
      @RequestParam(required = false, name = "consultanteId")  String consultanteId,
      @RequestParam(required = false, name = "consultanteUid") String consultanteUid,
      @RequestParam String from,
      @RequestParam String to
  ) throws Exception {
    String cUid = (consultanteUid != null && !consultanteUid.isBlank())
        ? consultanteUid : (consultanteId != null ? consultanteId : "");

    if (cUid.isBlank()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
          "Paramètre manquant: consultanteId (ou consultanteUid) est requis");
    }
    if (!from.matches("\\d{4}-\\d{2}-\\d{2}") || !to.matches("\\d{4}-\\d{2}-\\d{2}")) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
          "Format de date invalide: utiliser YYYY-MM-DD pour 'from' et 'to'");
    }

    try {
      return ResponseEntity.ok(service.getAvailableSlots(cUid, from, to));
    } catch (Exception e) {
      throw new ResponseStatusException(
          HttpStatus.INTERNAL_SERVER_ERROR,
          "Impossible de récupérer les créneaux: " + (e.getMessage() != null ? e.getMessage() : e.toString()),
          e
      );
    }
  }

  @PostMapping("/rendezvous")
  public ResponseEntity<Map<String,Object>> book(Authentication auth, @RequestBody Map<String,Object> body) throws Exception {
    return ResponseEntity.ok(service.bookRendezVous(uid(auth), body));
  }

  @GetMapping({"/rdv","/rendezvous"})
  public ResponseEntity<List<Map<String,Object>>> myRdv(
      Authentication auth,
      @RequestParam(required = false) String from,
      @RequestParam(required = false) String to
  ) throws Exception {
    return ResponseEntity.ok(service.getMyAppointments(uid(auth), from, to));
  }

  /* ===== WhatsApp consultante pour un projet (format attendu par le front) ===== */
  // Renvoie { found: boolean, phoneE164?: string, display?: string, reason?: string }
  @GetMapping("/projects/{projectId}/whatsapp")
  public ResponseEntity<Map<String,Object>> consultanteWhatsapp(@PathVariable String projectId) throws Exception {
    Map<String,Object> out = projectService.getConsultanteWhatsappForProject(projectId);
    return ResponseEntity.ok(out);
  }
}
