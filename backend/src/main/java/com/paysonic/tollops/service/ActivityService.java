package com.paysonic.tollops.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.paysonic.tollops.dto.*;
import com.paysonic.tollops.entity.AuditLog;
import com.paysonic.tollops.entity.LoginHistory;
import com.paysonic.tollops.entity.UserSession;
import com.paysonic.tollops.repository.AuditLogRepository;
import com.paysonic.tollops.repository.LoginHistoryRepository;
import com.paysonic.tollops.repository.UserRepository;
import com.paysonic.tollops.repository.UserSessionRepository;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class ActivityService {

    private final UserRepository userRepository;
    private final UserSessionRepository userSessionRepository;
    private final LoginHistoryRepository loginHistoryRepository;
    private final AuditLogRepository auditLogRepository;
    private final ObjectMapper objectMapper;

    public ActivityService(UserRepository userRepository,
                           UserSessionRepository userSessionRepository,
                           LoginHistoryRepository loginHistoryRepository,
                           AuditLogRepository auditLogRepository,
                           ObjectMapper objectMapper) {
        this.userRepository = userRepository;
        this.userSessionRepository = userSessionRepository;
        this.loginHistoryRepository = loginHistoryRepository;
        this.auditLogRepository = auditLogRepository;
        this.objectMapper = objectMapper;
    }

    public DashboardStatsDTO getDashboardStats() {
        DashboardStatsDTO stats = new DashboardStatsDTO();

        long totalUsers = userRepository.count();
        stats.setTotalUsers(totalUsers);
        stats.setTotalUsersDelta(0.0);

        long activeCount = userSessionRepository.countByStatus("Active");
        stats.setActiveUsers(activeCount);
        stats.setActiveUsersDelta(0.0);

        long inactiveCount = userRepository.countByStatus("Inactive");
        stats.setInactiveUsers(inactiveCount);
        stats.setInactiveUsersDelta(0.0);

        long lockedCount = userRepository.countByLocked(true);
        stats.setLockedUsers(lockedCount);
        stats.setLockedUsersDelta(0.0);

        LocalDateTime startOfToday = LocalDate.now().atStartOfDay();
        long failedLogins = loginHistoryRepository.countFailedSince(startOfToday);
        stats.setFailedLoginsToday(failedLogins);
        stats.setFailedLoginsDelta(0.0);

        long activitiesToday = auditLogRepository.countActivitiesSince(startOfToday);
        stats.setTotalActivitiesToday(activitiesToday);
        stats.setTotalActivitiesDelta(0.0);

        long criticalEvents = auditLogRepository.countCriticalEvents();
        stats.setCriticalSecurityEvents(criticalEvents);
        stats.setCriticalSecurityEventsDelta(0.0);

        long exportsPerformed = auditLogRepository.countByAction("EXPORT_AUDIT_LOG");
        stats.setExportsPerformed(exportsPerformed);
        stats.setExportsPerformedDelta(0.0);

        return stats;
    }

    public LoginTrendDTO getLoginTrend(int days) {
        int dayCount = days > 0 ? days : 7;
        List<String> labels = new ArrayList<>();
        List<Integer> successful = new ArrayList<>();
        List<Integer> failed = new ArrayList<>();

        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("MMM d");
        LocalDate now = LocalDate.now();
        LocalDateTime cutoff = now.minusDays(dayCount - 1).atStartOfDay();

        List<LoginHistory> recentLogins = loginHistoryRepository.findByTimestampAfter(cutoff, Sort.by(Sort.Direction.ASC, "timestamp"));

        for (int i = dayCount - 1; i >= 0; i--) {
            LocalDate date = now.minusDays(i);
            labels.add(date.format(formatter));

            long successCount = recentLogins.stream()
                    .filter(lh -> lh.getTimestamp() != null && lh.getTimestamp().toLocalDate().isEqual(date) && "Success".equalsIgnoreCase(lh.getStatus()))
                    .count();
            long failCount = recentLogins.stream()
                    .filter(lh -> lh.getTimestamp() != null && lh.getTimestamp().toLocalDate().isEqual(date) && "Failed".equalsIgnoreCase(lh.getStatus()))
                    .count();

            successful.add((int) successCount);
            failed.add((int) failCount);
        }

        Map<String, List<Integer>> datasets = new HashMap<>();
        datasets.put("successful", successful);
        datasets.put("failed", failed);

        return new LoginTrendDTO(dayCount, labels, datasets);
    }

    public List<ModuleBreakdownDTO> getModuleBreakdown() {
        List<Object[]> rows = auditLogRepository.findModuleCounts();
        long total = auditLogRepository.count();
        if (total == 0) total = 1;

        List<ModuleBreakdownDTO> list = new ArrayList<>();
        for (Object[] row : rows) {
            String name = (String) row[0];
            long count = ((Number) row[1]).longValue();
            int percentage = (int) Math.round(((double) count / total) * 100);
            list.add(new ModuleBreakdownDTO(name, count, percentage));
        }
        return list;
    }

    public List<AuditLogResponseDTO> getRecentActivity(int limit) {
        int max = limit > 0 ? limit : 10;
        return auditLogRepository.findAll(Sort.by(Sort.Direction.DESC, "timestamp"))
                .stream()
                .limit(max)
                .map(log -> AuditLogResponseDTO.fromEntity(log, objectMapper))
                .collect(Collectors.toList());
    }

    public List<UserSession> getActiveSessions() {
        return userSessionRepository.findByStatus("Active");
    }

    @Transactional
    public Map<String, Object> forceLogout(String sessionId, String reason, String actorId, String ipAddress) {
        UserSession session = userSessionRepository.findById(sessionId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Session not found: " + sessionId));

        userSessionRepository.delete(session);

        // Record revocation audit event (UAM-FR-007)
        String eventId = "AUD-" + String.valueOf(System.currentTimeMillis()).substring(7);
        AuditLog auditEvent = new AuditLog(
                eventId,
                LocalDateTime.now(),
                "User Management",
                "FORCE_LOGOUT",
                "Terminated Active Session",
                "WARNING",
                actorId != null ? actorId : "PSN0005",
                "Sanjay Kulkarni",
                "Master Admin",
                ipAddress != null ? ipAddress : "103.21.58.44",
                session.getPlaza(),
                session.getName() + " (" + session.getUserId() + ")",
                sessionId,
                "CORR-FL-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase(),
                "Session forcefully terminated. Reason: " + (reason != null ? reason : "Administrative revocation"),
                "{\"sessionActive\": true, \"sessionId\": \"" + sessionId + "\"}",
                "{\"sessionActive\": false, \"reason\": \"" + reason + "\"}"
        );
        auditLogRepository.save(auditEvent);

        Map<String, Object> result = new HashMap<>();
        result.put("success", true);
        result.put("sessionId", sessionId);
        result.put("message", "Session successfully revoked");
        return result;
    }

    public List<LoginHistory> getLoginHistory(String status) {
        Sort sort = Sort.by(Sort.Direction.DESC, "timestamp");
        if (status != null && !status.isBlank() && !"All".equalsIgnoreCase(status)) {
            return loginHistoryRepository.findByStatus(status, sort);
        }
        return loginHistoryRepository.findAll(sort);
    }

    public List<AuditLogResponseDTO> getAuditLog(AuditFilterRequest filters) {
        Specification<AuditLog> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            if (filters.getSearch() != null && !filters.getSearch().isBlank()) {
                String q = "%" + filters.getSearch().toLowerCase().trim() + "%";
                Predicate searchPred = cb.or(
                        cb.like(cb.lower(root.get("id")), q),
                        cb.like(cb.lower(root.get("target")), q),
                        cb.like(cb.lower(root.get("actionLabel")), q),
                        cb.like(cb.lower(root.get("actorName")), q),
                        cb.like(cb.lower(root.get("actorRole")), q),
                        cb.like(cb.lower(root.get("details")), q)
                );
                predicates.add(searchPred);
            }

            if (filters.getModule() != null && !"All modules".equalsIgnoreCase(filters.getModule())) {
                predicates.add(cb.equal(root.get("module"), filters.getModule()));
            }

            if (filters.getStatus() != null && !"All statuses".equalsIgnoreCase(filters.getStatus())) {
                predicates.add(cb.equal(root.get("status"), filters.getStatus()));
            }

            if (filters.getPlaza() != null && !"All plazas".equalsIgnoreCase(filters.getPlaza())) {
                predicates.add(cb.equal(root.get("plaza"), filters.getPlaza()));
            }

            return cb.and(predicates.toArray(new Predicate[0]));
        };

        return auditLogRepository.findAll(spec, Sort.by(Sort.Direction.DESC, "timestamp"))
                .stream()
                .map(log -> AuditLogResponseDTO.fromEntity(log, objectMapper))
                .collect(Collectors.toList());
    }

    @Transactional
    public ExportResponseDTO exportAudit(AuditFilterRequest filters, String actorId, String ipAddress) {
        List<AuditLogResponseDTO> records = getAuditLog(filters);
        String format = (filters.getFormat() != null) ? filters.getFormat().toLowerCase() : "csv";

        // UAM-FR-014: Log the export event itself into the audit trail
        String eventId = "AUD-" + String.valueOf(System.currentTimeMillis()).substring(7);
        AuditLog exportEvent = new AuditLog(
                eventId,
                LocalDateTime.now(),
                "Transactional Report",
                "EXPORT_AUDIT_LOG",
                "Exported Audit Ledger",
                "SUCCESS",
                actorId != null ? actorId : "PSN0005",
                "Sanjay Kulkarni",
                "Master Admin",
                ipAddress != null ? ipAddress : "103.21.58.44",
                "All plazas",
                "Audit Export (" + records.size() + " records, " + format.toUpperCase() + ")",
                "EXP-" + LocalDate.now().toString().replace("-", ""),
                "CORR-EXP-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase(),
                "Compliance export compiled for " + records.size() + " records in " + format.toUpperCase() + " format",
                null,
                "{\"format\":\"" + format + "\", \"recordCount\":" + records.size() + "}"
        );
        auditLogRepository.save(exportEvent);

        String filename = "paysonic_audit_export_" + LocalDate.now().toString() + "." + format;

        if ("csv".equalsIgnoreCase(format)) {
            StringBuilder sb = new StringBuilder();
            sb.append("Event ID,Timestamp,Actor Name,Actor Role,Module,Action,Reference ID,Correlation ID,Target,Plaza Scope,Outcome,IP Address\n");
            for (AuditLogResponseDTO r : records) {
                sb.append(String.format("%s,%s,\"%s\",\"%s\",\"%s\",\"%s\",\"%s\",\"%s\",\"%s\",\"%s\",%s,%s\n",
                        r.getId(),
                        r.getTimestamp() != null ? r.getTimestamp().toString() : "",
                        r.getActor() != null ? r.getActor().getName() : "",
                        r.getActor() != null ? r.getActor().getRole() : "",
                        r.getModule() != null ? r.getModule() : "",
                        r.getActionLabel() != null ? r.getActionLabel() : r.getAction(),
                        r.getReferenceId() != null ? r.getReferenceId() : "",
                        r.getCorrelationId() != null ? r.getCorrelationId() : "",
                        r.getTarget() != null ? r.getTarget().replace("\"", "\"\"") : "",
                        r.getPlaza() != null ? r.getPlaza() : "",
                        r.getStatus() != null ? r.getStatus() : "SUCCESS",
                        r.getActor() != null ? r.getActor().getIpAddress() : "127.0.0.1"
                ));
            }
            return new ExportResponseDTO(sb.toString(), filename, "text/csv", records.size());
        }

        try {
            String jsonContent = objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(records);
            return new ExportResponseDTO(jsonContent, filename, "application/json", records.size());
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "JSON serialization failed", e);
        }
    }
}
