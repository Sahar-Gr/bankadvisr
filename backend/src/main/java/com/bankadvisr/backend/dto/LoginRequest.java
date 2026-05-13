package com.bankadvisr.backend.dto;

public class LoginRequest {
    private String email;
    private String password;

    // ✅ Constructeur vide
    public LoginRequest() {}

    // ✅ Getters
    public String getEmail() {
        return email;
    }

    public String getPassword() {
        return password;
    }

    // ✅ Setters (aussi nécessaires pour @RequestBody)
    public void setEmail(String email) {
        this.email = email;
    }

    public void setPassword(String password) {
        this.password = password;
    }
}
