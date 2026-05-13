package com.bankadvisr.backend.dto;

import lombok.Builder;
import lombok.Data;

@Data @Builder
public class DocumentDTO {
    private String id;
    private String name;
    private String contentType;
    private long size;
    private String status;        // "en_attente" / "traite"
    private String storagePath;
    private String uploadedBy;
    private String uploadedByRole;
    private long createdAt;
}
