package com.paysonic.tollops.aspect;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.paysonic.tollops.entity.AuditLog;
import com.paysonic.tollops.repository.AuditLogRepository;
import jakarta.servlet.http.HttpServletRequest;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.time.LocalDateTime;
import java.util.UUID;

@Aspect
@Component
public class AuditTrailAspect {

    private static final Logger log = LoggerFactory.getLogger(AuditTrailAspect.class);

    private final AuditLogRepository auditLogRepository;
    private final com.paysonic.tollops.repository.UserRepository userRepository;
    private final ObjectMapper objectMapper;

    public AuditTrailAspect(AuditLogRepository auditLogRepository,
                            com.paysonic.tollops.repository.UserRepository userRepository,
                            ObjectMapper objectMapper) {
        this.auditLogRepository = auditLogRepository;
        this.userRepository = userRepository;
        this.objectMapper = objectMapper;
    }

    @Around("@annotation(auditable)")
    public Object auditMethod(ProceedingJoinPoint joinPoint, Auditable auditable) throws Throwable {
        HttpServletRequest request = null;
        ServletRequestAttributes attributes = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
        if (attributes != null) {
            request = attributes.getRequest();
        }

        String correlationId = (request != null && request.getHeader("X-Correlation-ID") != null)
                ? request.getHeader("X-Correlation-ID")
                : "CORR-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();

        String actorId = (request != null && request.getHeader("X-Actor-ID") != null)
                ? request.getHeader("X-Actor-ID")
                : "PSN0001";

        String actorName = "Administrator";
        String actorRole = "Admin";
        if (userRepository != null && actorId != null) {
            var actorOpt = userRepository.findById(actorId);
            if (actorOpt.isPresent()) {
                actorName = actorOpt.get().getName();
                actorRole = actorOpt.get().getRole();
            }
        }
        String ipAddress = request != null ? getClientIp(request) : "127.0.0.1";

        String beforeJson = null;
        Object[] args = joinPoint.getArgs();
        if (args != null && args.length > 0) {
            try {
                beforeJson = SecretFilterUtil.sanitizeJson(objectMapper.writeValueAsString(args[0]), objectMapper);
            } catch (Exception ignored) {}
        }

        String targetEntity = auditable.target().isBlank() ? auditable.module() : auditable.target();
        String referenceEntityId = correlationId;
        String details = "Operation executed successfully";

        // Enrich User Management operations with exact target user identity
        if ("User Management".equalsIgnoreCase(auditable.module()) || auditable.action().toUpperCase().contains("USER")) {
            if (args != null && args.length > 0 && args[0] instanceof String targetId) {
                if (userRepository != null) {
                    var targetOpt = userRepository.findById(targetId);
                    if (targetOpt.isPresent()) {
                        var targetUser = targetOpt.get();
                        targetEntity = targetUser.getName() + " (" + targetUser.getId() + ")";
                        referenceEntityId = targetUser.getId();
                        try {
                            // Snapshot full user state into beforeJson so history preserves user details even after deletion
                            beforeJson = SecretFilterUtil.sanitizeJson(objectMapper.writeValueAsString(targetUser), objectMapper);
                        } catch (Exception ignored) {}
                        if ("DELETE_USER".equalsIgnoreCase(auditable.action())) {
                            details = "User account " + targetUser.getName() + " (ID: " + targetUser.getId() + ", " + targetUser.getRole() + ") was deleted and moved to trash by " + actorName;
                        } else if ("TOGGLE_LOCK".equalsIgnoreCase(auditable.action())) {
                            details = "User account security lock toggled for " + targetUser.getName() + " (ID: " + targetUser.getId() + ") by " + actorName;
                        } else if ("APPROVE_USER".equalsIgnoreCase(auditable.action())) {
                            details = "User onboarding request for " + targetUser.getName() + " (ID: " + targetUser.getId() + ") was approved by " + actorName;
                        } else if ("ACTIVATE_USER".equalsIgnoreCase(auditable.action())) {
                            details = "User account activated for " + targetUser.getName() + " (ID: " + targetUser.getId() + ") by " + actorName;
                        }
                    } else {
                        referenceEntityId = targetId;
                        targetEntity = "User " + targetId;
                    }
                }
            }
        }

        Object result;
        String status = "SUCCESS";
        String afterJson = null;

        try {
            result = joinPoint.proceed();
            if (result != null) {
                try {
                    afterJson = SecretFilterUtil.sanitizeJson(objectMapper.writeValueAsString(result), objectMapper);
                } catch (Exception ignored) {}

                // If CREATE_USER or UPDATE_USER returned UserResponseDTO, enrich target details
                if (result instanceof com.paysonic.tollops.dto.UserResponseDTO dto) {
                    targetEntity = dto.getName() + " (" + dto.getId() + ")";
                    referenceEntityId = dto.getId();
                    if ("CREATE_USER".equalsIgnoreCase(auditable.action())) {
                        details = "New user account provisioned for " + dto.getName() + " (ID: " + dto.getId() + ", Role: " + dto.getRole() + ") by " + actorName;
                    } else if ("UPDATE_USER".equalsIgnoreCase(auditable.action())) {
                        details = "User profile updated for " + dto.getName() + " (ID: " + dto.getId() + ") by " + actorName;
                    }
                }
            }
            return result;
        } catch (Throwable ex) {
            status = "FAILURE";
            details = "Operation failed: " + ex.getMessage();
            throw ex;
        } finally {
            try {
                String eventId = "AUD-" + String.valueOf(System.currentTimeMillis()).substring(7);
                AuditLog logEntry = new AuditLog(
                        eventId,
                        LocalDateTime.now(),
                        auditable.module(),
                        auditable.action(),
                        auditable.actionLabel(),
                        status,
                        actorId,
                        actorName,
                        actorRole,
                        ipAddress,
                        "All plazas",
                        targetEntity,
                        referenceEntityId,
                        correlationId,
                        details,
                        beforeJson,
                        afterJson
                );
                auditLogRepository.save(logEntry);
            } catch (Exception e) {
                log.error("Failed to persist AOP audit log entry", e);
            }
        }
    }

    private String getClientIp(HttpServletRequest request) {
        String xf = request.getHeader("X-Forwarded-For");
        if (xf != null && !xf.isBlank()) {
            return xf.split(",")[0].trim();
        }
        return request.getRemoteAddr() != null ? request.getRemoteAddr() : "127.0.0.1";
    }
}
