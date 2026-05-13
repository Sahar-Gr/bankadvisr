package com.bankadvisr.backend.controller;

import com.bankadvisr.backend.service.ProjectService;
import com.bankadvisr.backend.service.DocumentService;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.util.*;

@RestController
@RequestMapping("/api/consultante")
@CrossOrigin(origins = "http://localhost:3000")
public class ConsultanteProjectsController {

  private final ProjectService projectService;
  private final DocumentService documentService;

  public ConsultanteProjectsController(ProjectService ps, DocumentService ds) {
    this.projectService = ps; this.documentService = ds;
  }

  @GetMapping("/projects")
  public ResponseEntity<List<Map<String,Object>>> list(
      @RequestHeader("X-Demo-Uid") String consultanteUid,
      @RequestParam(required=false) String statut,
      @RequestParam(name="client", required=false) String clientUid
  ) throws Exception {
    return ResponseEntity.ok(projectService.listProjectsForConsultante(consultanteUid, clientUid, statut));
  }

  @GetMapping("/projects/{id}")
  public ResponseEntity<Map<String,Object>> get(@PathVariable String id) throws Exception {
    var p = projectService.getProjectById(id);
    if (p == null) return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error","Projet introuvable"));
    return ResponseEntity.ok(p);
  }

  @PatchMapping("/projects/{id}/terminer")
  public ResponseEntity<Map<String,Object>> terminer(@PathVariable String id) throws Exception {
    return ResponseEntity.ok(projectService.markProjectTermine(id));
  }

  @GetMapping("/projects/{id}/documents")
  public ResponseEntity<List<?>> docs(@PathVariable String id) throws Exception {
    return ResponseEntity.ok(documentService.list(id));
  }

  @PostMapping(value="/projects/{id}/documents-traites", consumes=MediaType.MULTIPART_FORM_DATA_VALUE)
  public ResponseEntity<?> uploadTraite(@PathVariable String id,
                                        @RequestHeader("X-Demo-Uid") String consultanteUid,
                                        @RequestParam("file") MultipartFile file) throws Exception {
    return ResponseEntity.ok(documentService.upload(id, file, consultanteUid, "consultante", true));
  }

  @GetMapping("/projects/{id}/documents/{docId}/download")
  public ResponseEntity<?> download(@PathVariable String id, @PathVariable String docId) throws Exception {
    var res = documentService.download(id, docId);
    return ResponseEntity.ok()
      .contentType(MediaType.APPLICATION_OCTET_STREAM)
      .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + res.getFilename() + "\"")
      .body(res);
  }
}
