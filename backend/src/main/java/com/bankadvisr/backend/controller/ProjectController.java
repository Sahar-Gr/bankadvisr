package com.bankadvisr.backend.controller;

import com.bankadvisr.backend.dto.ProjectCreateRequest;
import com.bankadvisr.backend.service.ProjectService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

// ===== SPRING BOOT 3.x =====
 import jakarta.validation.Valid;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
@CrossOrigin(origins = "http://localhost:3000")
public class ProjectController {

  private final ProjectService projectService;

  public ProjectController(ProjectService projectService) {
    this.projectService = projectService;
  }

  // ---------- CREATE ----------
  // POST /api/admin/projects
  @PostMapping(value = "/projects", consumes = "application/json", produces = "application/json")
  public ResponseEntity<Map<String, Object>> create(@Valid @RequestBody ProjectCreateRequest body) throws Exception {
    Map<String, Object> created = projectService.createProject(body);
    return ResponseEntity.status(HttpStatus.CREATED).body(created);
  }

  // ---------- LIST ----------
  // GET /api/admin/projects?clientUid=...
  @GetMapping(value = "/projects", produces = "application/json")
  public ResponseEntity<List<Map<String, Object>>> list(@RequestParam(required = false) String clientUid) throws Exception {
    return ResponseEntity.ok(projectService.listProjects(clientUid));
  }

  // ---------- UPDATE (partial) ----------
  // PATCH /api/admin/projects/{id}
  @PatchMapping(value = "/projects/{id}", consumes = "application/json", produces = "application/json")
  public ResponseEntity<Map<String, Object>> patch(
      @PathVariable String id,
      @RequestBody Map<String, Object> patch) throws Exception {
    Map<String, Object> updated = projectService.patchProject(id, patch);
    return ResponseEntity.ok(updated);
  }

  // ---------- UPDATE (PUT) ----------
  // PUT /api/admin/projects/{id}
  @PutMapping(value = "/projects/{id}", consumes = "application/json", produces = "application/json")
  public ResponseEntity<Map<String, Object>> put(
      @PathVariable String id,
      @RequestBody Map<String, Object> patch) throws Exception {
    Map<String, Object> updated = projectService.patchProject(id, patch);
    return ResponseEntity.ok(updated);
  }
// ---------- GET BY ID ----------
// GET /api/admin/projects/{id}
@GetMapping(value = "/projects/{id}", produces = "application/json")
public ResponseEntity<Map<String, Object>> getById(@PathVariable String id) throws Exception {
  Map<String, Object> p = projectService.getProjectById(id);

  if (p == null) {
    return ResponseEntity.status(HttpStatus.NOT_FOUND)
        .body(Map.of("error", "Projet introuvable: " + id));
  }

  return ResponseEntity.ok(p);
}

  // ---------- ASSIGNATION CONSULTANTE ----------
  @PatchMapping(value = "/projects/assign-consultante", consumes = "application/json", produces = "application/json")
  public ResponseEntity<Map<String, Object>> assignConsultanteToClient(@RequestBody Map<String, String> body) throws Exception {

    String clientUid = body.get("clientUid");
    String consultanteUid = body.get("consultanteUid");

    if (clientUid == null || clientUid.isBlank() || consultanteUid == null || consultanteUid.isBlank()) {
      throw new IllegalArgumentException("clientUid et consultanteUid sont requis");
    }

    int count = projectService.assignConsultanteToClient(clientUid, consultanteUid);
    return ResponseEntity.ok(Map.of("message", "Assignation terminée", "projetsMisAJour", count));
  }
  // ---------- DELETE PROJECT ----------
  // DELETE /api/admin/projects/{id}
  @DeleteMapping(value = "/projects/{id}")
  public ResponseEntity<Map<String, String>> delete(@PathVariable String id) throws Exception {
    try {
        projectService.deleteProject(id);
        return ResponseEntity.ok(Map.of("message", "Projet supprimé avec succès"));
    } catch (IllegalArgumentException e) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", e.getMessage()));
    } catch (Exception e) {
        e.printStackTrace(); // Pour voir l'erreur exacte dans tes logs Gradle
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", "Erreur serveur"));
    }
  }
}
