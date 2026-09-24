package com.paysonic.tollops.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

@Entity
@Table(name = "users")
public class User {

    @Id
    @Column(name = "id", length = 32, nullable = false)
    private String id;

    @Column(name = "name", length = 100, nullable = false)
    private String name;

    @Column(name = "email", length = 120, nullable = false, unique = true)
    private String email;

    @Column(name = "mobile", length = 20, nullable = false)
    private String mobile;

    @Column(name = "role", length = 50, nullable = false)
    private String role;

    @Column(name = "user_type", length = 50, nullable = false)
    private String userType = "Toll Plaza";

    @Column(name = "assigned_plaza", length = 100)
    private String assignedPlaza;

    @Column(name = "plazas_json", columnDefinition = "TEXT")
    private String plazasJson;

    @Column(name = "status", length = 20, nullable = false)
    private String status = "Pending";

    @Column(name = "approval", length = 20, nullable = false)
    private String approval = "Pending";

    @Column(name = "locked", nullable = false)
    private boolean locked = false;

    @Column(name = "password", length = 120, nullable = false)
    private String password = "Paysonic@2026";

    @Column(name = "avatar", length = 255)
    private String avatar;

    @Column(name = "last_active")
    private LocalDateTime lastActive;

    @Column(name = "created_by", length = 50, nullable = false)
    private String createdBy = "SYSTEM";

    @Column(name = "approved_by", length = 50)
    private String approvedBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    public User() {}

    public User(String id, String name, String email, String mobile, String role, String userType, String assignedPlaza, String status, String approval, boolean locked, String createdBy) {
        this.id = id;
        this.name = name;
        this.email = email;
        this.mobile = mobile;
        this.role = role;
        this.userType = userType != null ? userType : "Toll Plaza";
        this.assignedPlaza = assignedPlaza;
        this.status = status != null ? status : "Pending";
        this.approval = approval != null ? approval : "Pending";
        this.locked = locked;
        this.createdBy = createdBy != null ? createdBy : "SYSTEM";
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    // Getters and Setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getMobile() { return mobile; }
    public void setMobile(String mobile) { this.mobile = mobile; }

    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }

    public String getUserType() { return userType; }
    public void setUserType(String userType) { this.userType = userType; }

    public String getAssignedPlaza() { return assignedPlaza; }
    public void setAssignedPlaza(String assignedPlaza) { this.assignedPlaza = assignedPlaza; }

    public String getPlazasJson() { return plazasJson; }
    public void setPlazasJson(String plazasJson) { this.plazasJson = plazasJson; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getApproval() { return approval; }
    public void setApproval(String approval) { this.approval = approval; }

    public boolean isLocked() { return locked; }
    public void setLocked(boolean locked) { this.locked = locked; }

    public String getAvatar() { return avatar; }
    public void setAvatar(String avatar) { this.avatar = avatar; }

    public LocalDateTime getLastActive() { return lastActive; }
    public void setLastActive(LocalDateTime lastActive) { this.lastActive = lastActive; }

    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }

    public String getApprovedBy() { return approvedBy; }
    public void setApprovedBy(String approvedBy) { this.approvedBy = approvedBy; }

    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password != null && !password.isBlank() ? password : "Paysonic@2026"; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
