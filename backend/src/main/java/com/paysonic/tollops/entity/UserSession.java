package com.paysonic.tollops.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "user_sessions")
public class UserSession {

    @Id
    @Column(name = "session_id", length = 64, nullable = false)
    private String sessionId;

    @Column(name = "user_id", length = 32, nullable = false)
    private String userId;

    @Column(name = "name", length = 100, nullable = false)
    private String name;

    @Column(name = "role", length = 50, nullable = false)
    private String role;

    @Column(name = "plaza", length = 100, nullable = false)
    private String plaza = "All plazas";

    @Column(name = "ip_address", length = 45, nullable = false)
    private String ipAddress;

    @Column(name = "device", length = 100, nullable = false)
    private String device;

    @Column(name = "login_time", nullable = false)
    private LocalDateTime loginTime = LocalDateTime.now();

    @Column(name = "last_active", nullable = false)
    private LocalDateTime lastActive = LocalDateTime.now();

    @Column(name = "status", length = 20, nullable = false)
    private String status = "Active";

    public UserSession() {}

    public UserSession(String sessionId, String userId, String name, String role, String plaza, String ipAddress, String device, LocalDateTime loginTime, LocalDateTime lastActive, String status) {
        this.sessionId = sessionId;
        this.userId = userId;
        this.name = name;
        this.role = role;
        this.plaza = plaza != null ? plaza : "All plazas";
        this.ipAddress = ipAddress;
        this.device = device;
        this.loginTime = loginTime != null ? loginTime : LocalDateTime.now();
        this.lastActive = lastActive != null ? lastActive : LocalDateTime.now();
        this.status = status != null ? status : "Active";
    }

    public String getSessionId() { return sessionId; }
    public void setSessionId(String sessionId) { this.sessionId = sessionId; }

    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }

    public String getPlaza() { return plaza; }
    public void setPlaza(String plaza) { this.plaza = plaza; }

    public String getIpAddress() { return ipAddress; }
    public void setIpAddress(String ipAddress) { this.ipAddress = ipAddress; }

    public String getDevice() { return device; }
    public void setDevice(String device) { this.device = device; }

    public LocalDateTime getLoginTime() { return loginTime; }
    public void setLoginTime(LocalDateTime loginTime) { this.loginTime = loginTime; }

    public LocalDateTime getLastActive() { return lastActive; }
    public void setLastActive(LocalDateTime lastActive) { this.lastActive = lastActive; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
}
