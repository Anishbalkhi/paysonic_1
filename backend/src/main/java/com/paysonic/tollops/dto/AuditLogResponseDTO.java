package com.paysonic.tollops.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.paysonic.tollops.entity.AuditLog;

import java.time.LocalDateTime;

public class AuditLogResponseDTO {

    private String id;
    
    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime timestamp;

    private String module;
    private String action;
    private String actionLabel;
    private String status;
    private ActorDTO actor;
    private String plaza;
    private String target;
    private String referenceId;
    private String correlationId;
    private String details;
    private Object before;
    private Object after;

    public static class ActorDTO {
        private String id;
        private String name;
        private String role;
        private String ipAddress;

        public ActorDTO() {}

        public ActorDTO(String id, String name, String role, String ipAddress) {
            this.id = id;
            this.name = name;
            this.role = role;
            this.ipAddress = ipAddress;
        }

        public String getId() { return id; }
        public void setId(String id) { this.id = id; }

        public String getName() { return name; }
        public void setName(String name) { this.name = name; }

        public String getRole() { return role; }
        public void setRole(String role) { this.role = role; }

        public String getIpAddress() { return ipAddress; }
        public void setIpAddress(String ipAddress) { this.ipAddress = ipAddress; }
    }

    public static AuditLogResponseDTO fromEntity(AuditLog log, ObjectMapper objectMapper) {
        AuditLogResponseDTO dto = new AuditLogResponseDTO();
        dto.setId(log.getId());
        dto.setTimestamp(log.getTimestamp());
        dto.setModule(log.getModule());
        dto.setAction(log.getAction());
        dto.setActionLabel(log.getActionLabel());
        dto.setStatus(log.getStatus());
        dto.setActor(new ActorDTO(log.getActorId(), log.getActorName(), log.getActorRole(), log.getActorIp()));
        dto.setPlaza(log.getPlaza());
        dto.setTarget(log.getTarget());
        dto.setReferenceId(log.getReferenceId());
        dto.setCorrelationId(log.getCorrelationId());
        dto.setDetails(log.getDetails());

        if (log.getBeforeJson() != null && !log.getBeforeJson().isBlank()) {
            try {
                dto.setBefore(objectMapper.readTree(log.getBeforeJson()));
            } catch (Exception e) {
                dto.setBefore(log.getBeforeJson());
            }
        }

        if (log.getAfterJson() != null && !log.getAfterJson().isBlank()) {
            try {
                dto.setAfter(objectMapper.readTree(log.getAfterJson()));
            } catch (Exception e) {
                dto.setAfter(log.getAfterJson());
            }
        }

        return dto;
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

    public ActorDTO getActor() { return actor; }
    public void setActor(ActorDTO actor) { this.actor = actor; }

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

    public Object getBefore() { return before; }
    public void setBefore(Object before) { this.before = before; }

    public Object getAfter() { return after; }
    public void setAfter(Object after) { this.after = after; }
}
