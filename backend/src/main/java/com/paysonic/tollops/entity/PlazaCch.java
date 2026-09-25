package com.paysonic.tollops.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "plaza_cch")
public class PlazaCch {

    @Id
    @Column(name = "plaza_id", length = 32, nullable = false)
    private String plazaId;

    @Column(name = "cch_json", columnDefinition = "LONGTEXT", nullable = false)
    private String cchJson;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    public PlazaCch() {}

    public PlazaCch(String plazaId, String cchJson) {
        this.plazaId = plazaId;
        this.cchJson = cchJson;
        this.updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    public void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

    public String getPlazaId() { return plazaId; }
    public void setPlazaId(String plazaId) { this.plazaId = plazaId; }

    public String getCchJson() { return cchJson; }
    public void setCchJson(String cchJson) { this.cchJson = cchJson; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
