package com.bankadvisr.backend.storage;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.core.io.UrlResource;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.net.MalformedURLException;
import java.nio.file.*;
import java.util.UUID;

@Slf4j
@Service
public class LocalDiskStorage implements ObjectStorage {

    @Value("${storage.local.root:./uploads}")
    private String root;

    @Override
    public StoredFile save(String projectId, MultipartFile file) throws Exception {
        if (file == null || file.isEmpty()) throw new IllegalArgumentException("Fichier vide.");
        String safeName = sanitize(file.getOriginalFilename());
        String rel = "projects/" + projectId + "/" + UUID.randomUUID() + "_" + safeName;

        Path target = Paths.get(root).resolve(rel).normalize().toAbsolutePath();
        Files.createDirectories(target.getParent());
        Files.copy(file.getInputStream(), target, StandardCopyOption.REPLACE_EXISTING);

        return StoredFile.builder()
                .storagePath(rel)
                .contentType(file.getContentType())
                .size(file.getSize())
                .originalName(safeName)
                .build();
    }

    @Override
    public UrlResource loadAsResource(String storagePath) throws MalformedURLException {
        Path p = Paths.get(root).resolve(storagePath).normalize().toAbsolutePath();
        return new UrlResource(p.toUri());
    }

    @Override
    public void delete(String storagePath) throws Exception {
        Path p = Paths.get(root).resolve(storagePath).normalize().toAbsolutePath();
        Files.deleteIfExists(p);
    }

    // Pas d'Apache Commons: version 100% Java
    private String sanitize(String name) {
        if (name == null || name.isBlank()) return "document";
        String base = name.replaceAll("[\\r\\n]", " ").trim();
        base = base.replaceAll("[^a-zA-Z0-9._ -]", "_");

        int maxLen = 120;
        if (base.length() > maxLen) {
            int dot = base.lastIndexOf('.');
            if (dot > 0 && dot < base.length() - 1) {
                String ext = base.substring(dot);
                int stemLen = Math.max(1, maxLen - ext.length());
                String stem = base.substring(0, stemLen);
                base = stem + ext;
            } else {
                base = base.substring(0, maxLen);
            }
        }
        return base;
    }
}
