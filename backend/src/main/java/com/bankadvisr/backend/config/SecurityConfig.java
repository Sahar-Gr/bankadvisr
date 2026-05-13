// SecurityConfig.java
package com.bankadvisr.backend.config;

import com.bankadvisr.backend.security.JwtAuthenticationFilter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

  @Bean
  SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
    http
      .csrf(csrf -> csrf.disable())
      .cors(cors -> {}) // active CORS (utilise le bean ci-dessous)
      .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
      .authorizeHttpRequests(auth -> auth
          // ✅ Pré-vols CORS
          .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
          .requestMatchers("/api/projets/**").authenticated()
          
          // ✅ Endpoints publics
          .requestMatchers(HttpMethod.POST, "/auth/login").permitAll()
          .requestMatchers(HttpMethod.POST, "/api/preview").permitAll()
          .requestMatchers("/error").permitAll()

          // 🔥 NOUVEAU : Autoriser la consultante à accéder aux ressources partagées
          .requestMatchers("/api/admin/clients/**").hasAnyRole("ADMIN", "CONSULTANTE")
          .requestMatchers("/api/admin/projects/**").hasAnyRole("ADMIN", "CONSULTANTE")
          .requestMatchers("/api/admin/consultantes/**").hasAnyRole("ADMIN", "CONSULTANTE")
          .requestMatchers("/api/admin/planning/**").hasAnyRole("ADMIN", "CONSULTANTE")

          // ✅ Rôles / permissions (IMPORTANT: Placé APRÈS les règles partagées ci-dessus)
          .requestMatchers("/api/admin/**").hasRole("ADMIN")
          .requestMatchers("/api/consultante/**").hasRole("CONSULTANTE")
          .requestMatchers("/api/client/**").hasRole("CLIENT")

          // ✅ Tout le reste : connecté obligatoire
          .anyRequest().authenticated()
      )
      .addFilterBefore(new JwtAuthenticationFilter(), UsernamePasswordAuthenticationFilter.class);

    return http.build();
  }

  @Bean
  CorsConfigurationSource corsConfigurationSource() {
    CorsConfiguration cfg = new CorsConfiguration();
    cfg.setAllowedOrigins(List.of("http://localhost:3000"));
    cfg.setAllowedMethods(List.of("GET","POST","PUT","PATCH","DELETE","OPTIONS"));
    cfg.setAllowedHeaders(List.of("Authorization","Content-Type","authorization","content-type"));
    cfg.setExposedHeaders(List.of("Authorization"));
    cfg.setAllowCredentials(true);

    UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
    source.registerCorsConfiguration("/**", cfg);
    return source;
  }
}