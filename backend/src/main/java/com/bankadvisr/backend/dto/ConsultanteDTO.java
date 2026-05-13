package com.bankadvisr.backend.dto;

public class ConsultanteDTO {
  private String uid;
  private String nom;
  private String prenom;
  private String email;
  private Boolean active;

  public String getUid() { return uid; }
  public void setUid(String uid) { this.uid = uid; }

  public String getNom() { return nom; }
  public void setNom(String nom) { this.nom = nom; }

  public String getPrenom() { return prenom; }
  public void setPrenom(String prenom) { this.prenom = prenom; }

  public String getEmail() { return email; }
  public void setEmail(String email) { this.email = email; }

  public Boolean getActive() { return active; }
  public void setActive(Boolean active) { this.active = active; }
}
