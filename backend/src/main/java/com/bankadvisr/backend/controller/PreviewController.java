package com.bankadvisr.backend.controller;

import org.apache.commons.io.FilenameUtils;
import org.jodconverter.core.DocumentConverter;
import org.springframework.core.io.InputStreamResource;
import org.springframework.core.io.Resource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.*;
import java.nio.file.Files;

@CrossOrigin(origins = "http://localhost:3000") // utile en dev; optionnel si CORS global est actif
@RestController
@RequestMapping("/api")
public class PreviewController {

    private final DocumentConverter converter;

    public PreviewController(DocumentConverter converter) {
        this.converter = converter;
    }

    @PostMapping(value = "/preview", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Resource> preview(@RequestPart("file") MultipartFile file) throws Exception {
        if (file == null || file.isEmpty()) return ResponseEntity.badRequest().build();

        String originalName = file.getOriginalFilename() != null ? file.getOriginalFilename() : "document";
        String ext = FilenameUtils.getExtension(originalName).toLowerCase();

        File src = Files.createTempFile("preview-src-", "." + ext).toFile();
        file.transferTo(src);

        if ("pdf".equals(ext)) {
            InputStreamResource res = new InputStreamResource(new FileInputStream(src));
            return buildPdfResponse(res, originalName.endsWith(".pdf") ? originalName : originalName + ".pdf");
        }

        File dstPdf = Files.createTempFile("preview-out-", ".pdf").toFile();
        try {
            converter.convert(src).to(dstPdf).execute();
            InputStreamResource res = new InputStreamResource(new FileInputStream(dstPdf));
            String outName = FilenameUtils.getBaseName(originalName) + ".pdf";
            return buildPdfResponse(res, outName);
        } finally {
            try { Files.deleteIfExists(src.toPath()); } catch (Exception ignored) {}
        }
    }

    private ResponseEntity<Resource> buildPdfResponse(InputStreamResource body, String fileName) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_PDF);
        headers.setContentDisposition(ContentDisposition.inline().filename(fileName).build());
        return ResponseEntity.ok().headers(headers).body(body);
    }
}
