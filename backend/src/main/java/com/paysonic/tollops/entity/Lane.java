package com.paysonic.tollops.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "lanes")
public class Lane {

    @Id
    @Column(name = "id", length = 64, nullable = false)
    private String id;

    @Column(name = "plaza_id", length = 32, nullable = false)
    private String plazaId;

    @Column(name = "lane_id", length = 32, nullable = false)
    private String laneId;

    @Column(name = "direction", length = 20, nullable = false)
    private String direction = "North";

    @Column(name = "type", length = 20, nullable = false)
    private String type = "Entry";

    @Column(name = "mode", length = 30, nullable = false)
    private String mode = "Normal";

    @Column(name = "category", length = 30, nullable = false)
    private String category = "Hybrid";

    @Column(name = "status", length = 30, nullable = false)
    private String status = "Open";

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    public Lane() {}

    public Lane(String plazaId, String laneId, String direction, String type, String mode, String category, String status) {
        this.id = plazaId + "_" + laneId;
        this.plazaId = plazaId;
        this.laneId = laneId;
        this.direction = direction;
        this.type = type;
        this.mode = mode;
        this.category = category;
        this.status = status;
    }

    @PreUpdate
    public void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getPlazaId() { return plazaId; }
    public void setPlazaId(String plazaId) { this.plazaId = plazaId; }

    public String getLaneId() { return laneId; }
    public void setLaneId(String laneId) { this.laneId = laneId; }

    public String getDirection() { return direction; }
    public void setDirection(String direction) { this.direction = direction; }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public String getMode() { return mode; }
    public void setMode(String mode) { this.mode = mode; }

    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
