package com.bankadvisr.backend.config;

import org.jodconverter.core.DocumentConverter;
import org.jodconverter.core.office.OfficeException;
import org.jodconverter.core.office.OfficeManager;
import org.jodconverter.local.LocalConverter;
import org.jodconverter.local.office.LocalOfficeManager;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Configuration de LibreOffice pour la conversion de documents (DOCX/XLSX/PPTX → PDF).
 * Utilise JODConverter + LibreOffice en mode headless.
 */
@Configuration
public class OfficeConfig {

    @Value("${app.office.home:C:\\\\Program Files\\\\LibreOffice}")
    private String officeHome;

    @Value("${app.office.port:2002}")
    private int port;

    @Value("${app.office.task-timeout-ms:120000}")
    private long taskTimeoutMs;

    @Value("${app.office.queue-timeout-ms:180000}")
    private long queueTimeoutMs;

    /**
     * Démarre LibreOffice en mode headless et l’expose comme OfficeManager.
     * Le process sera arrêté automatiquement à la fermeture de Spring Boot.
     */
    @Bean(destroyMethod = "stop")
    public OfficeManager officeManager() throws OfficeException {
        LocalOfficeManager manager = LocalOfficeManager.builder()
                .officeHome(officeHome)
                .install()                      // installe les fichiers nécessaires si absents
                .portNumbers(port)              // port par défaut 2002
                .taskExecutionTimeout(taskTimeoutMs)
                .taskQueueTimeout(queueTimeoutMs)
                .build();

        // 🔹 Démarrage explicite du processus LibreOffice
        try {
            manager.start();
            System.out.println("✅ LibreOffice démarré sur le port " + port);
        } catch (OfficeException e) {
            System.err.println("❌ Erreur lors du démarrage de LibreOffice : " + e.getMessage());
            throw e;
        }

        return manager;
    }

    /**
     * Fournit un bean DocumentConverter à injecter (utilisé par PreviewController).
     */
    @Bean
    public DocumentConverter documentConverter(OfficeManager officeManager) {
        return LocalConverter.builder()
                .officeManager(officeManager)
                .build();
    }
}
