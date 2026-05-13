package com.bankadvisr.backend.storage;

import org.springframework.core.io.Resource;
import org.springframework.web.multipart.MultipartFile;

public interface ObjectStorage {
    StoredFile save(String projectId, MultipartFile file) throws Exception;
    Resource loadAsResource(String storagePath) throws Exception;
    void delete(String storagePath) throws Exception;
}
