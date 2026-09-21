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
    private final ObjectMapper objectMapper;

    public AuditTrailAspect(AuditLogRepository auditLogRepository, ObjectMapper objectMapper) {
        this.auditLogRepository = auditLogRepository;
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
                : "PSN0005";

        String actorName = "Sanjay Kulkarni";
        String actorRole = "Master Admin";
        String ipAddress = request != null ? getClientIp(request) : "127.0.0.1";

        String beforeJson = null;
        Object[] args = joinPoint.getArgs();
        if (args != null && args.length > 0) {
            try {
                beforeJson = SecretFilterUtil.sanitizeJson(objectMapper.writeValueAsString(args[0]), objectMapper);
            } catch (Exception ignored) {}
        }

        Object result;
        String status = "SUCCESS";
        String details = "Operation executed successfully";
        String afterJson = null;

        try {
            result = joinPoint.proceed();
            if (result != null) {
                try {
                    afterJson = SecretFilterUtil.sanitizeJson(objectMapper.writeValueAsString(result), objectMapper);
                } catch (Exception ignored) {}
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
                        auditable.target().isBlank() ? auditable.module() : auditable.target(),
                        correlationId,
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
