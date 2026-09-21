package com.paysonic.tollops.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "audit_logs")
public class AuditLog {

    @Id
    @Column(name = "id", length = 32, nullable = false)
    private String id;

    @Column(name = "timestamp", nullable = false)
    private LocalDateTime timestamp = LocalDateTime.now();

    @Column(name = "module", length = 80, nullable = false)
    private String module;

    @Column(name = "action", length = 80, nullable = false)
    private String action;

    @Column(name = "action_label", length = 120, nullable = false)
    private String actionLabel;

    @Column(name = "status", length = 20, nullable = false)
    private String status = "SUCCESS";

    @Column(name = "actor_id", length = 32, nullable = false)
    private String actorId = "PSN0005";

    @Column(name = "actor_name", length = 100, nullable = false)
    private String actorName = "Sanjay Kulkarni";

    @Column(name = "actor_role", length = 50, nullable = false)
    private String actorRole = "Master Admin";

    @Column(name = "actor_ip", length = 45, nullable = false)
    private String actorIp = "103.21.58.44";

    @Column(name = "plaza", length = 100, nullable = false)
    private String plaza = "All plazas";

    @Column(name = "target", length = 150, nullable = false)
    private String target;

    @Column(name = "reference_id", length = 64)
    private String referenceId;

    @Column(name = "correlation_id", length = 64)
    private String correlationId;

    @Column(name = "details", columnDefinition = "TEXT", nullable = false)
    private String details;

    @Column(name = "before_json", columnDefinition = "LONGTEXT")
    private String beforeJson;

    @Column(name = "after_json", columnDefinition = "LONGTEXT")
    private String afterJson;

    public AuditLog() {}

    public AuditLog(String id, LocalDateTime timestamp, String module, String action, String actionLabel, String status,
                    String actorId, String actorName, String actorRole, String actorIp, String plaza, String target,
                    String referenceId, String correlationId, String details, String beforeJson, String afterJson) {
        this.id = id;
        this.timestamp = timestamp != null ? timestamp : LocalDateTime.now();
        this.module = module;
        this.action = action;
        this.actionLabel = actionLabel;
        this.status = status != null ? status : "SUCCESS";
        this.actorId = actorId;
        this.actorName = actorName;
        this.actorRole = actorRole;
        this.actorIp = actorIp;
        this.plaza = plaza != null ? plaza : "All plazas";
        this.target = target;
        this.referenceId = referenceId;
        this.correlationId = correlationId;
        this.details = details;
        this.beforeJson = beforeJson;
        this.afterJson = afterJson;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public LocalDateTime getTimestamp() { return timestamp; }
    public void setTimestamp(LocalDateTime timestamp) { this.timestamp = timestamp; }

    public String getModule() { return module; }
    public void setModule(String module) { this.module = module; }

    public String getAction() { return action; }
    public void setAction(String action) { this.action = action; }

    public String getActionLabel() { return actionLabel; }
    public void setActionLabel(String actionLabel) { this.actionLabel = actionLabel; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getActorId() { return actorId; }
    public void setActorId(String actorId) { this.actorId = actorId; }

    public String getActorName() { return actorName; }
    public void setActorName(String actorName) { this.actorName = actorName; }

    public String getActorRole() { return actorRole; }
    public void setActorRole(String actorRole) { this.actorRole = actorRole; }

    public String getActorIp() { return actorIp; }
    public void setActorIp(String actorIp) { this.actorIp = actorIp; }

    public String getPlaza() { return plaza; }
    public void setPlaza(String plaza) { this.plaza = plaza; }

    public String getTarget() { return target; }
    public void setTarget(String target) { this.target = target; }

    public String getReferenceId() { return referenceId; }
    public void setReferenceId(String referenceId) { this.referenceId = referenceId; }

    public String getCorrelationId() { return correlationId; }
    public void setCorrelationId(String correlationId) { this.correlationId = correlationId; }

    public String getDetails() { return details; }
    public void setDetails(String details) { this.details = details; }

    public String getBeforeJson() { return beforeJson; }
    public void setBeforeJson(String beforeJson) { this.beforeJson = beforeJson; }

    public String getAfterJson() { return afterJson; }
    public void setAfterJson(String afterJson) { this.afterJson = afterJson; }
}
