package com.paysonic.tollops.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "plaza_fares")
public class PlazaFare {

    @Id
    @Column(name = "plaza_id", length = 32, nullable = false)
    private String plazaId;

    @Column(name = "fares_json", columnDefinition = "LONGTEXT", nullable = false)
    private String faresJson;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    public PlazaFare() {}

    public PlazaFare(String plazaId, String faresJson) {
        this.plazaId = plazaId;
        this.faresJson = faresJson;
        this.updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    public void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

    public String getPlazaId() { return plazaId; }
    public void setPlazaId(String plazaId) { this.plazaId = plazaId; }

    public String getFaresJson() { return faresJson; }
    public void setFaresJson(String faresJson) { this.faresJson = faresJson; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
