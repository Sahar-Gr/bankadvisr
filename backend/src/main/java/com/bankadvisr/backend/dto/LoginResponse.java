package com.bankadvisr.backend.dto;

public class LoginResponse {
    private String uid;
    private String role;
    private String message;
    private String token;

    // ✅ Constructeur par défaut
    public LoginResponse() {}

    // ✅ Constructeur avec paramètres
    public LoginResponse(String uid, String role, String message) {
        this.uid = uid;
        this.role = role;
        this.message = message;
        this.token = token;
    }

    // ✅ Getters
    public String getUid() {
        return uid;
    }

    public String getRole() {
        return role;
    }

    public String getMessage() {
        return message;
    }

    // ✅ Setters
    public void setUid(String uid) {
        this.uid = uid;
    }

    public void setRole(String role) {
        this.role = role;
    }

    public void setMessage(String message) {
        this.message = message;
    }
}
