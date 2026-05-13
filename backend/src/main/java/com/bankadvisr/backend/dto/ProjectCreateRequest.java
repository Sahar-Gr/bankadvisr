package com.bankadvisr.backend.dto;

import jakarta.validation.constraints.NotBlank;



public class ProjectCreateRequest {

 
  private String clientUid;

  // optionnel
  private String consultanteUid;

  
  private String titre;

  
  private String description;

  // getters/setters
  public String getClientUid() { return clientUid; }
  public void setClientUid(String clientUid) { this.clientUid = clientUid; }

  public String getConsultanteUid() { return consultanteUid; }
  public void setConsultanteUid(String consultanteUid) { this.consultanteUid = consultanteUid; }

  public String getTitre() { return titre; }
  public void setTitre(String titre) { this.titre = titre; }

  public String getDescription() { return description; }
  public void setDescription(String description) { this.description = description; }
}
