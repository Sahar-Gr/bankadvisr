package com.bankadvisr.backend.controller;

import com.google.cloud.firestore.Firestore;
import com.google.firebase.cloud.FirestoreClient;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
@RequestMapping("/api/contacts/whatsapp")
@CrossOrigin(origins = "http://localhost:3000")
public class ContactsController {
  @PostMapping("/log")
  public ResponseEntity<Void> log(@RequestBody Map<String,Object> body,
                                  @RequestHeader("X-Demo-Uid") String fromUid) throws Exception {
    Firestore db = FirestoreClient.getFirestore();
    Map<String,Object> rec = new HashMap<>(body);
    rec.put("fromUid", fromUid);
    rec.putIfAbsent("direction", "outbound");
    rec.put("channel", "whatsapp");
    rec.put("createdAt", System.currentTimeMillis());
    db.collection("contactLogs").add(rec).get();
    return ResponseEntity.ok().build();
  }
}
