package com.bankadvisr.backend.storage;

import lombok.Builder;
import lombok.Data;

@Data @Builder
public class StoredFile {
    private String storagePath;   // ex: projects/{projectId}/{uuid}_nom.ext
    private String contentType;
    private long size;
    private String originalName;
}
