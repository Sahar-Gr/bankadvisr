// JwtAuthenticationFilter.java
package com.bankadvisr.backend.security;

import com.bankadvisr.backend.util.JwtUtil;
import io.jsonwebtoken.Claims;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

public class JwtAuthenticationFilter extends OncePerRequestFilter {

  @Override
  protected void doFilterInternal(HttpServletRequest request,
                                  HttpServletResponse response,
                                  FilterChain filterChain) throws ServletException, IOException {

    // ✅ Laisser passer les pré-vols CORS
    if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
      filterChain.doFilter(request, response);
      return;
    }

    // ✅ Laisser passer le login sans token
    String uri = request.getRequestURI();
    if (uri != null && uri.equals("/auth/login")) {
      filterChain.doFilter(request, response);
      return;
    }

    String header = request.getHeader("Authorization");

    // ✅ Si pas de header Bearer => pas d'auth (Spring Security décidera ensuite: 401/403)
    if (header == null || !header.startsWith("Bearer ")) {
      filterChain.doFilter(request, response);
      return;
    }

    String token = header.substring(7);

    try {
      Claims claims = JwtUtil.validateToken(token);
      String uid  = claims.getSubject();
      String role = claims.get("role", String.class);

      // ⚠️ ROLE_ + role en MAJ (ADMIN/CLIENT/CONSULTANTE)
      var authentication = new UsernamePasswordAuthenticationToken(
          uid,
          null,
          List.of(new SimpleGrantedAuthority("ROLE_" + role.toUpperCase()))
      );

      SecurityContextHolder.getContext().setAuthentication(authentication);
      filterChain.doFilter(request, response);

    } catch (Exception e) {
      // ✅ Token invalide/expiré => 401
      response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
      response.setContentType("application/json");
      response.getWriter().write("{\"error\":\"invalid or expired token\"}");
    }
  }
}
