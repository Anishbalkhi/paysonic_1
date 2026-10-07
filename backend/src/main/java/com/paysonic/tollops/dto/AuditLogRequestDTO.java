package com.paysonic.tollops.dto;

import java.time.LocalDateTime;

public class AuditLogRequestDTO {
    private String id;
    private LocalDateTime timestamp;
    private String module;
    private String action;
    private String actionLabel;
    private String status;
    private String plaza;
    private String target;
    private String referenceId;
    private String correlationId;
    private String details;
    private String actorId;
    private String actorName;
    private String actorRole;
    private String actorIp;
    private Object before;
    private Object after;

    public AuditLogRequestDTO() {}

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

    public String getActorId() { return actorId; }
    public void setActorId(String actorId) { this.actorId = actorId; }

    public String getActorName() { return actorName; }
    public void setActorName(String actorName) { this.actorName = actorName; }

    public String getActorRole() { return role(actorRole); }
    public void setActorRole(String actorRole) { this.actorRole = actorRole; }

    private String role(String r) { return r != null ? r : "Admin"; }

    public String getActorIp() { return actorIp; }
    public void setActorIp(String actorIp) { this.actorIp = actorIp; }

    public Object getBefore() { return before; }
    public void setBefore(Object before) { this.before = before; }

    public Object getAfter() { return after; }
    public void setAfter(Object after) { this.after = after; }
}
