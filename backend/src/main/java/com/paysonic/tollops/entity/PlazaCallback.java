package com.paysonic.tollops.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "plaza_callbacks")
public class PlazaCallback {

    @Id
    @Column(name = "plaza_id", length = 32, nullable = false)
    private String plazaId;

    @Column(name = "callbacks_json", columnDefinition = "LONGTEXT", nullable = false)
    private String callbacksJson;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    public PlazaCallback() {}

    public PlazaCallback(String plazaId, String callbacksJson) {
        this.plazaId = plazaId;
        this.callbacksJson = callbacksJson;
        this.updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    public void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

    public String getPlazaId() { return plazaId; }
    public void setPlazaId(String plazaId) { this.plazaId = plazaId; }

    public String getCallbacksJson() { return callbacksJson; }
    public void setCallbacksJson(String callbacksJson) { this.callbacksJson = callbacksJson; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
