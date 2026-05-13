package com.bankadvisr.backend.controller;

import com.bankadvisr.backend.service.AdminService;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
@CrossOrigin(origins = "http://localhost:3000") // front React
public class AdminController {

    private final AdminService adminService;

    public AdminController(AdminService adminService) {
        this.adminService = adminService;
    }

    // =========================
    // CLIENTS
    // =========================

    // LIST
    @GetMapping("/clients")
    public ResponseEntity<List<Map<String, Object>>> listClients() throws Exception {
        return ResponseEntity.ok(adminService.listClients());
    }

    // CREATE
    @PostMapping("/clients")
    public ResponseEntity<Map<String, Object>> createClient(
            @RequestBody Map<String, Object> body
    ) throws Exception {
        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(adminService.createClient(body));
    }

    // UPDATE FULL (utilisé par le front)
    @PutMapping("/clients/{uid}")
    public ResponseEntity<Map<String, Object>> updateClient(
            @PathVariable String uid,
            @RequestBody Map<String, Object> updates
    ) throws Exception {
        return ResponseEntity.ok(adminService.updateClient(uid, updates));
    }

    // UPDATE PARTIAL (PATCH — Postman / actions ciblées)
    @PatchMapping("/clients/{uid}")
    public ResponseEntity<Map<String, Object>> patchClient(
            @PathVariable String uid,
            @RequestBody Map<String, Object> updates
    ) throws Exception {
        return ResponseEntity.ok(adminService.updateClient(uid, updates));
    }

    // ACTIVER / DÉSACTIVER
    @PutMapping("/clients/{uid}/active")
    public ResponseEntity<Void> toggleClientActive(
            @PathVariable String uid,
            @RequestParam boolean active
    ) throws Exception {
        adminService.toggleClientActive(uid, active);
        return ResponseEntity.noContent().build();
    }

    // DELETE
    @DeleteMapping("/clients/{uid}")
    public ResponseEntity<Void> deleteClient(@PathVariable String uid) throws Exception {
        adminService.deleteClient(uid);
        return ResponseEntity.noContent().build();
    }

    // =========================
    // CONSULTANTES
    // =========================

    @GetMapping("/consultantes")
    public ResponseEntity<List<Map<String, Object>>> listConsultantes() throws Exception {
        return ResponseEntity.ok(adminService.listConsultantes());
    }
}
