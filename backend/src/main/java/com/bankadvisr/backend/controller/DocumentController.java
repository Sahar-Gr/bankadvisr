package com.bankadvisr.backend.controller;

import com.bankadvisr.backend.dto.DocumentDTO;
import com.bankadvisr.backend.service.DocumentService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.*;

@CrossOrigin(
  origins = {"http://localhost:3000","http://localhost:5173","http://localhost:4200"},
  allowedHeaders = {"Authorization","Content-Type","X-User-Uid","Range"},
  exposedHeaders = {"Accept-Ranges","Content-Range","Content-Disposition"},
  methods = {RequestMethod.GET, RequestMethod.POST, RequestMethod.DELETE, RequestMethod.PATCH, RequestMethod.OPTIONS}
)
@RestController
@RequestMapping("/api/projets")
@RequiredArgsConstructor
public class DocumentController {

    private final DocumentService service;

    private String resolveUid(HttpServletRequest req, String fallback) {
        Object attr = req.getAttribute("uid");
        if (attr instanceof String s && !s.isBlank()) return s;
        String head = req.getHeader("X-User-Uid");
        if (head != null && !head.isBlank()) return head;
        return fallback;
    }

    // -------- Upload côté CLIENT (statut en_attente) --------
    @PostMapping(value="/{projectId}/documents", consumes=MediaType.MULTIPART_FORM_DATA_VALUE)
    public DocumentDTO uploadClient(@PathVariable String projectId,
                                    @RequestPart("file") MultipartFile file,
                                    HttpServletRequest req) throws Exception {
        String uid = resolveUid(req, "client");
        return service.upload(projectId, file, uid, "client", false);
    }

    // -------- Upload côté CONSULTANTE (statut valide) --------
    @PostMapping(value="/{projectId}/documents-traites", consumes=MediaType.MULTIPART_FORM_DATA_VALUE)
    public DocumentDTO uploadConsultante(@PathVariable String projectId,
                                         @RequestPart("file") MultipartFile file,
                                         HttpServletRequest req) throws Exception {
        String uid = resolveUid(req, "consultante");
        return service.upload(projectId, file, uid, "consultante", true);
    }

    // -------- Liste --------
    @GetMapping("/{projectId}/documents")
    public List<DocumentDTO> list(@PathVariable String projectId) throws Exception {
        return service.list(projectId);
    }

    // -------- Download ORIGINAL (TOUS types)  --------
    @GetMapping("/{projectId}/documents/{docId}/download")
    public ResponseEntity<Resource> download(@PathVariable String projectId,
                                             @PathVariable String docId) throws Exception {
        Resource res = service.download(projectId, docId);
        String filename = service.getOriginalFilename(projectId, docId);
        String contentType = Optional.ofNullable(service.getContentType(projectId, docId))
                .orElse(MediaType.APPLICATION_OCTET_STREAM_VALUE);

        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(contentType))
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .body(res);
    }

    // -------- Prévisualisation PDF (inline) avec Byte-Range --------
    @GetMapping("/{projectId}/documents/{docId}/preview")
    public ResponseEntity<Resource> preview(@PathVariable String projectId,
                                            @PathVariable String docId,
                                            @RequestHeader(value = "Range", required = false) String rangeHeader) throws Exception {
        Resource res = service.download(projectId, docId);
        String filename = service.getOriginalFilename(projectId, docId);
        String contentType = Optional.ofNullable(service.getContentType(projectId, docId))
                .orElse("application/pdf");

        // on n'accepte ici que les PDFs (le reste doit passer par /api/preview côté front)
        if (!contentType.toLowerCase().contains("pdf") && !filename.toLowerCase().endsWith(".pdf")) {
            return ResponseEntity.status(HttpStatus.UNSUPPORTED_MEDIA_TYPE).build(); // 415
        }

        long fullLength = res.contentLength();

        if (rangeHeader == null) {
            return ResponseEntity.ok()
                    .contentType(MediaType.parseMediaType(contentType))
                    .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + filename + "\"")
                    .header(HttpHeaders.ACCEPT_RANGES, "bytes")
                    .contentLength(fullLength)
                    .body(res);
        }

        HttpRange httpRange = HttpRange.parseRanges(rangeHeader).get(0);
        long start = httpRange.getRangeStart(fullLength);
        long end   = httpRange.getRangeEnd(fullLength);
        long rangeLength = end - start + 1;

        return ResponseEntity.status(HttpStatus.PARTIAL_CONTENT)
                .contentType(MediaType.parseMediaType(contentType))
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + filename + "\"")
                .header(HttpHeaders.ACCEPT_RANGES, "bytes")
                .header(HttpHeaders.CONTENT_RANGE, "bytes " + start + "-" + end + "/" + fullLength)
                .contentLength(rangeLength)
                .body(res);
    }

    // -------- Suppression --------
    // -------- Suppression sécurisée --------
    @DeleteMapping("/{projectId}/documents/{docId}")
    public ResponseEntity<Void> delete(@PathVariable String projectId,
                                       @PathVariable String docId,
                                       HttpServletRequest req) throws Exception {
        // On récupère l'UID et le Role injectés par ton JwtAuthenticationFilter
        String uid = (String) req.getAttribute("uid");
        String role = (String) req.getAttribute("role");

        // Si ton filtre n'injecte pas le rôle, on peut le récupérer via le header si tu l'as configuré
        if (role == null) role = req.getHeader("X-User-Role"); 

        service.delete(projectId, docId, uid, role);
        return ResponseEntity.noContent().build();
    }
}
