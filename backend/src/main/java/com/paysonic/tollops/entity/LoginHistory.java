package com.paysonic.tollops.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "login_history")
public class LoginHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", length = 32, nullable = false)
    private String userId;

    @Column(name = "name", length = 100, nullable = false)
    private String name;

    @Column(name = "role", length = 50, nullable = false)
    private String role;

    @Column(name = "timestamp", nullable = false)
    private LocalDateTime timestamp = LocalDateTime.now();

    @Column(name = "ip_address", length = 45, nullable = false)
    private String ipAddress;

    @Column(name = "device", length = 100, nullable = false)
    private String device;

    @Column(name = "status", length = 20, nullable = false)
    private String status = "Success";

    @Column(name = "failure_reason", length = 255)
    private String failureReason;

    public LoginHistory() {}

    public LoginHistory(String userId, String name, String role, LocalDateTime timestamp, String ipAddress, String device, String status, String failureReason) {
        this.userId = userId;
        this.name = name;
        this.role = role;
        this.timestamp = timestamp != null ? timestamp : LocalDateTime.now();
        this.ipAddress = ipAddress;
        this.device = device;
        this.status = status != null ? status : "Success";
        this.failureReason = failureReason;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }

    public LocalDateTime getTimestamp() { return timestamp; }
    public void setTimestamp(LocalDateTime timestamp) { this.timestamp = timestamp; }

    public String getIpAddress() { return ipAddress; }
    public void setIpAddress(String ipAddress) { this.ipAddress = ipAddress; }

    public String getDevice() { return device; }
    public void setDevice(String device) { this.device = device; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getFailureReason() { return failureReason; }
    public void setFailureReason(String failureReason) { this.failureReason = failureReason; }
}
