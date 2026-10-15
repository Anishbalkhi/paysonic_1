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

        expireInactiveSessions();
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

    @Transactional
    public void expireInactiveSessions() {
        LocalDateTime cutoff = LocalDateTime.now().minusMinutes(5);
        List<UserSession> activeSessions = userSessionRepository.findByStatus("Active");
        List<UserSession> toTerminate = new ArrayList<>();
        for (UserSession s : activeSessions) {
            LocalDateTime lastTime = s.getLastActive() != null ? s.getLastActive() : s.getLoginTime();
            if (lastTime == null || lastTime.isBefore(cutoff)) {
                s.setStatus("Terminated");
                s.setReason("Session timed out after 5 minutes of inactivity");
                s.setLastActive(lastTime != null ? lastTime : LocalDateTime.now());
                toTerminate.add(s);
            }
        }
        if (!toTerminate.isEmpty()) {
            userSessionRepository.saveAll(toTerminate);
        }
    }

    public List<UserSession> getActiveSessions() {
        expireInactiveSessions();
        return userSessionRepository.findByStatus("Active");
    }

    @Transactional
    public Map<String, Object> touchSession(String sessionId) {
        if (sessionId == null || sessionId.isBlank()) {
            return Map.of("active", false, "status", "Terminated", "message", "Invalid sessionId");
        }
        Optional<UserSession> sessionOpt = userSessionRepository.findById(sessionId);
        if (sessionOpt.isEmpty()) {
            return Map.of("active", false, "status", "Terminated", "message", "Session not found");
        }
        UserSession s = sessionOpt.get();
        if (!"Active".equalsIgnoreCase(s.getStatus())) {
            return Map.of("active", false, "status", s.getStatus(), "reason", s.getReason() != null ? s.getReason() : "");
        }
        LocalDateTime cutoff = LocalDateTime.now().minusMinutes(5);
        LocalDateTime lastTime = s.getLastActive() != null ? s.getLastActive() : s.getLoginTime();
        if (lastTime != null && lastTime.isBefore(cutoff)) {
            s.setStatus("Terminated");
            s.setReason("Session timed out after 5 minutes of inactivity");
            userSessionRepository.save(s);
            return Map.of("active", false, "status", "Terminated", "reason", "Session timed out after 5 minutes of inactivity");
        }
        s.setLastActive(LocalDateTime.now());
        userSessionRepository.save(s);
        return Map.of("active", true, "status", "Active");
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

    /**
     * Registers a new active session.
     * Enforces the Single Device Rule:
     * - Only Master Admin can be logged in on multiple devices concurrently.
     * - All other roles are restricted to one active session at a time on a single device;
     *   any previous active sessions for that user are terminated immediately.
     * - On the same device, previous sessions for the same user are always refreshed.
     */
    @Transactional
    public UserSession registerSession(UserSession session) {
        if (session.getSessionId() == null || session.getSessionId().isBlank()) {
            session.setSessionId("SES-" + System.currentTimeMillis());
        }
        if (session.getLoginTime() == null) {
            session.setLoginTime(LocalDateTime.now());
        }
        if (session.getLastActive() == null) {
            session.setLastActive(LocalDateTime.now());
        }
        session.setStatus("Active");

        // Expire any dormant sessions across the board
        expireInactiveSessions();

        List<UserSession> existingSessions = userSessionRepository.findByUserId(session.getUserId());
        String newDeviceId = session.getDeviceId() != null ? session.getDeviceId().trim() : "";
        for (UserSession s : existingSessions) {
            if ("Active".equalsIgnoreCase(s.getStatus()) && !s.getSessionId().equals(session.getSessionId())) {
                String existingDeviceId = s.getDeviceId() != null ? s.getDeviceId().trim() : "";
                boolean isSameDevice = !newDeviceId.isEmpty() && !existingDeviceId.isEmpty()
                        && newDeviceId.equalsIgnoreCase(existingDeviceId);

                // Terminate if not Master Admin OR if logging in again on the same device
                if (!"Master Admin".equalsIgnoreCase(session.getRole()) || isSameDevice) {
                    s.setStatus("Terminated");
                    s.setLastActive(LocalDateTime.now());
                    if (isSameDevice) {
                        s.setReason("Session refreshed on same device");
                    } else {
                        s.setReason("Account was logged in on another device");
                    }
                    userSessionRepository.save(s);
                }
            }
        }

        return userSessionRepository.save(session);
    }

    /**
     * Checks if a session is currently active or has been superseded/terminated.
     */
    public Map<String, Object> getSessionStatus(String sessionId) {
        Optional<UserSession> sessionOpt = userSessionRepository.findById(sessionId);
        if (sessionOpt.isEmpty()) {
            return Map.of("active", false, "status", "Terminated", "reason", "Session terminated", "terminatedByDifferentDevice", false);
        }
        UserSession session = sessionOpt.get();
        LocalDateTime cutoff = LocalDateTime.now().minusMinutes(5);
        LocalDateTime lastTime = session.getLastActive() != null ? session.getLastActive() : session.getLoginTime();
        if ("Active".equalsIgnoreCase(session.getStatus()) && lastTime != null && lastTime.isBefore(cutoff)) {
            session.setStatus("Terminated");
            session.setReason("Session timed out after 5 minutes of inactivity");
            userSessionRepository.save(session);
        }
        boolean active = "Active".equalsIgnoreCase(session.getStatus());
        Map<String, Object> res = new HashMap<>();
        res.put("active", active);
        res.put("status", session.getStatus());
        res.put("sessionId", sessionId);
        res.put("userId", session.getUserId());
        res.put("deviceId", session.getDeviceId());
        res.put("reason", session.getReason() != null ? session.getReason() : "");
        boolean terminatedByDifferentDevice = !active && "Account was logged in on another device".equalsIgnoreCase(session.getReason());
        res.put("terminatedByDifferentDevice", terminatedByDifferentDevice);
        return res;
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

        if ("csv".equalsIgnoreCase(format)) {
            String filename = "paysonic_audit_export_" + LocalDate.now().toString() + ".csv";
            StringBuilder sb = new StringBuilder();
            sb.append("Sr No,Event ID,Timestamp,Actor Name,Actor Role,Module,Action,Reference ID,Correlation ID,Target,Plaza Scope,Outcome,IP Address,Details\n");
            int idx = 1;
            for (AuditLogResponseDTO r : records) {
                sb.append(String.format("%d,%s,%s,\"%s\",\"%s\",\"%s\",\"%s\",\"%s\",\"%s\",\"%s\",\"%s\",%s,%s,\"%s\"\n",
                        idx++,
                        r.getId(),
                        r.getTimestamp() != null ? r.getTimestamp().toString() : "",
                        r.getActor() != null ? escapeCsv(r.getActor().getName()) : "",
                        r.getActor() != null ? escapeCsv(r.getActor().getRole()) : "",
                        r.getModule() != null ? escapeCsv(r.getModule()) : "",
                        r.getActionLabel() != null ? escapeCsv(r.getActionLabel()) : escapeCsv(r.getAction()),
                        r.getReferenceId() != null ? escapeCsv(r.getReferenceId()) : "",
                        r.getCorrelationId() != null ? escapeCsv(r.getCorrelationId()) : "",
                        r.getTarget() != null ? escapeCsv(r.getTarget()) : "",
                        r.getPlaza() != null ? escapeCsv(r.getPlaza()) : "",
                        r.getStatus() != null ? r.getStatus() : "SUCCESS",
                        r.getActor() != null ? escapeCsv(r.getActor().getIpAddress()) : "127.0.0.1",
                        r.getDetails() != null ? escapeCsv(r.getDetails()) : ""
                ));
            }
            return new ExportResponseDTO(sb.toString(), filename, "text/csv", records.size());
        }

        if ("excel".equalsIgnoreCase(format) || "xls".equalsIgnoreCase(format)) {
            String filename = "paysonic_audit_export_" + LocalDate.now().toString() + ".xls";
            String xml = buildExcelXml(records);
            return new ExportResponseDTO(xml, filename, "application/vnd.ms-excel;charset=utf-8", records.size());
        }

        try {
            String filename = "paysonic_audit_export_" + LocalDate.now().toString() + ".json";
            String jsonContent = objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(records);
            return new ExportResponseDTO(jsonContent, filename, "application/json", records.size());
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "JSON serialization failed", e);
        }
    }

    private String escapeXml(String value) {
        if (value == null) return "";
        return value.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&apos;");
    }

    private String escapeCsv(String value) {
        if (value == null) return "";
        return value.replace("\"", "\"\"");
    }

    private String buildExcelXml(List<AuditLogResponseDTO> records) {
        DateTimeFormatter dtf = DateTimeFormatter.ofPattern("dd-MM-yyyy HH:mm:ss");
        String fetchTimeStr = LocalDateTime.now().format(dtf);

        StringBuilder sb = new StringBuilder();
        sb.append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
        sb.append("<?mso-application progid=\"Excel.Sheet\"?>\n");
        sb.append("<Workbook xmlns=\"urn:schemas-microsoft-com:office:spreadsheet\"\n");
        sb.append(" xmlns:o=\"urn:schemas-microsoft-com:office:office\"\n");
        sb.append(" xmlns:x=\"urn:schemas-microsoft-com:office:excel\"\n");
        sb.append(" xmlns:ss=\"urn:schemas-microsoft-com:office:spreadsheet\"\n");
        sb.append(" xmlns:html=\"http://www.w3.org/TR/REC-html40\">\n");
        sb.append(" <DocumentProperties xmlns=\"urn:schemas-microsoft-com:office:office\">\n");
        sb.append("  <Author>Paysonic Operations</Author>\n");
        sb.append("  <Created>").append(LocalDateTime.now().toString()).append("</Created>\n");
        sb.append(" </DocumentProperties>\n");
        sb.append(" <Styles>\n");
        sb.append("  <Style ss:ID=\"Default\" ss:Name=\"Normal\">\n");
        sb.append("   <Alignment ss:Vertical=\"Center\"/>\n");
        sb.append("   <Borders/>\n");
        sb.append("   <Font ss:FontName=\"Calibri\" ss:Size=\"10\" ss:Color=\"#1E293B\"/>\n");
        sb.append("   <Interior/>\n");
        sb.append("   <NumberFormat/>\n");
        sb.append("   <Protection/>\n");
        sb.append("  </Style>\n");
        sb.append("  <Style ss:ID=\"sTitle\">\n");
        sb.append("   <Alignment ss:Horizontal=\"Center\" ss:Vertical=\"Center\"/>\n");
        sb.append("   <Font ss:FontName=\"Calibri\" ss:Size=\"14\" ss:Color=\"#0F2F6B\" ss:Bold=\"1\"/>\n");
        sb.append("  </Style>\n");
        sb.append("  <Style ss:ID=\"sSubtitle\">\n");
        sb.append("   <Alignment ss:Horizontal=\"Center\" ss:Vertical=\"Center\"/>\n");
        sb.append("   <Font ss:FontName=\"Calibri\" ss:Size=\"10\" ss:Color=\"#475569\"/>\n");
        sb.append("  </Style>\n");
        sb.append("  <Style ss:ID=\"sGreenBar\">\n");
        sb.append("   <Interior ss:Color=\"#10B981\" ss:Pattern=\"Solid\"/>\n");
        sb.append("  </Style>\n");
        sb.append("  <Style ss:ID=\"sHeader\">\n");
        sb.append("   <Alignment ss:Horizontal=\"Center\" ss:Vertical=\"Center\" ss:WrapText=\"1\"/>\n");
        sb.append("   <Borders>\n");
        sb.append("    <Border ss:Position=\"Bottom\" ss:LineStyle=\"Continuous\" ss:Weight=\"1\" ss:Color=\"#CBD5E1\"/>\n");
        sb.append("    <Border ss:Position=\"Left\" ss:LineStyle=\"Continuous\" ss:Weight=\"1\" ss:Color=\"#CBD5E1\"/>\n");
        sb.append("    <Border ss:Position=\"Right\" ss:LineStyle=\"Continuous\" ss:Weight=\"1\" ss:Color=\"#CBD5E1\"/>\n");
        sb.append("    <Border ss:Position=\"Top\" ss:LineStyle=\"Continuous\" ss:Weight=\"1\" ss:Color=\"#CBD5E1\"/>\n");
        sb.append("   </Borders>\n");
        sb.append("   <Font ss:FontName=\"Calibri\" ss:Size=\"10.5\" ss:Color=\"#FFFFFF\" ss:Bold=\"1\"/>\n");
        sb.append("   <Interior ss:Color=\"#0F2F6B\" ss:Pattern=\"Solid\"/>\n");
        sb.append("  </Style>\n");
        sb.append("  <Style ss:ID=\"sDataCenter\">\n");
        sb.append("   <Alignment ss:Horizontal=\"Center\" ss:Vertical=\"Center\"/>\n");
        sb.append("   <Borders>\n");
        sb.append("    <Border ss:Position=\"Bottom\" ss:LineStyle=\"Continuous\" ss:Weight=\"1\" ss:Color=\"#E2E8F0\"/>\n");
        sb.append("    <Border ss:Position=\"Left\" ss:LineStyle=\"Continuous\" ss:Weight=\"1\" ss:Color=\"#E2E8F0\"/>\n");
        sb.append("    <Border ss:Position=\"Right\" ss:LineStyle=\"Continuous\" ss:Weight=\"1\" ss:Color=\"#E2E8F0\"/>\n");
        sb.append("    <Border ss:Position=\"Top\" ss:LineStyle=\"Continuous\" ss:Weight=\"1\" ss:Color=\"#E2E8F0\"/>\n");
        sb.append("   </Borders>\n");
        sb.append("   <Font ss:FontName=\"Calibri\" ss:Size=\"9.5\" ss:Color=\"#1E293B\"/>\n");
        sb.append("  </Style>\n");
        sb.append("  <Style ss:ID=\"sDataText\">\n");
        sb.append("   <Alignment ss:Horizontal=\"Left\" ss:Vertical=\"Center\"/>\n");
        sb.append("   <Borders>\n");
        sb.append("    <Border ss:Position=\"Bottom\" ss:LineStyle=\"Continuous\" ss:Weight=\"1\" ss:Color=\"#E2E8F0\"/>\n");
        sb.append("    <Border ss:Position=\"Left\" ss:LineStyle=\"Continuous\" ss:Weight=\"1\" ss:Color=\"#E2E8F0\"/>\n");
        sb.append("    <Border ss:Position=\"Right\" ss:LineStyle=\"Continuous\" ss:Weight=\"1\" ss:Color=\"#E2E8F0\"/>\n");
        sb.append("    <Border ss:Position=\"Top\" ss:LineStyle=\"Continuous\" ss:Weight=\"1\" ss:Color=\"#E2E8F0\"/>\n");
        sb.append("   </Borders>\n");
        sb.append("   <Font ss:FontName=\"Calibri\" ss:Size=\"9.5\" ss:Color=\"#1E293B\"/>\n");
        sb.append("  </Style>\n");
        sb.append("  <Style ss:ID=\"sSuccess\">\n");
        sb.append("   <Alignment ss:Horizontal=\"Center\" ss:Vertical=\"Center\"/>\n");
        sb.append("   <Borders>\n");
        sb.append("    <Border ss:Position=\"Bottom\" ss:LineStyle=\"Continuous\" ss:Weight=\"1\" ss:Color=\"#E2E8F0\"/>\n");
        sb.append("    <Border ss:Position=\"Left\" ss:LineStyle=\"Continuous\" ss:Weight=\"1\" ss:Color=\"#E2E8F0\"/>\n");
        sb.append("    <Border ss:Position=\"Right\" ss:LineStyle=\"Continuous\" ss:Weight=\"1\" ss:Color=\"#E2E8F0\"/>\n");
        sb.append("    <Border ss:Position=\"Top\" ss:LineStyle=\"Continuous\" ss:Weight=\"1\" ss:Color=\"#E2E8F0\"/>\n");
        sb.append("   </Borders>\n");
        sb.append("   <Font ss:FontName=\"Calibri\" ss:Size=\"9.5\" ss:Color=\"#047857\" ss:Bold=\"1\"/>\n");
        sb.append("   <Interior ss:Color=\"#D1FAE5\" ss:Pattern=\"Solid\"/>\n");
        sb.append("  </Style>\n");
        sb.append("  <Style ss:ID=\"sWarning\">\n");
        sb.append("   <Alignment ss:Horizontal=\"Center\" ss:Vertical=\"Center\"/>\n");
        sb.append("   <Borders>\n");
        sb.append("    <Border ss:Position=\"Bottom\" ss:LineStyle=\"Continuous\" ss:Weight=\"1\" ss:Color=\"#E2E8F0\"/>\n");
        sb.append("    <Border ss:Position=\"Left\" ss:LineStyle=\"Continuous\" ss:Weight=\"1\" ss:Color=\"#E2E8F0\"/>\n");
        sb.append("    <Border ss:Position=\"Right\" ss:LineStyle=\"Continuous\" ss:Weight=\"1\" ss:Color=\"#E2E8F0\"/>\n");
        sb.append("    <Border ss:Position=\"Top\" ss:LineStyle=\"Continuous\" ss:Weight=\"1\" ss:Color=\"#E2E8F0\"/>\n");
        sb.append("   </Borders>\n");
        sb.append("   <Font ss:FontName=\"Calibri\" ss:Size=\"9.5\" ss:Color=\"#B45309\" ss:Bold=\"1\"/>\n");
        sb.append("   <Interior ss:Color=\"#FEF3C7\" ss:Pattern=\"Solid\"/>\n");
        sb.append("  </Style>\n");
        sb.append("  <Style ss:ID=\"sFailure\">\n");
        sb.append("   <Alignment ss:Horizontal=\"Center\" ss:Vertical=\"Center\"/>\n");
        sb.append("   <Borders>\n");
        sb.append("    <Border ss:Position=\"Bottom\" ss:LineStyle=\"Continuous\" ss:Weight=\"1\" ss:Color=\"#E2E8F0\"/>\n");
        sb.append("    <Border ss:Position=\"Left\" ss:LineStyle=\"Continuous\" ss:Weight=\"1\" ss:Color=\"#E2E8F0\"/>\n");
        sb.append("    <Border ss:Position=\"Right\" ss:LineStyle=\"Continuous\" ss:Weight=\"1\" ss:Color=\"#E2E8F0\"/>\n");
        sb.append("    <Border ss:Position=\"Top\" ss:LineStyle=\"Continuous\" ss:Weight=\"1\" ss:Color=\"#E2E8F0\"/>\n");
        sb.append("   </Borders>\n");
        sb.append("   <Font ss:FontName=\"Calibri\" ss:Size=\"9.5\" ss:Color=\"#B91C1C\" ss:Bold=\"1\"/>\n");
        sb.append("   <Interior ss:Color=\"#FEE2E2\" ss:Pattern=\"Solid\"/>\n");
        sb.append("  </Style>\n");
        sb.append(" </Styles>\n");
        sb.append(" <Worksheet ss:Name=\"Audit Ledger\">\n");
        sb.append("  <Table ss:DefaultRowHeight=\"20\">\n");
        sb.append("   <Column ss:Width=\"45\"/>\n");
        sb.append("   <Column ss:Width=\"110\"/>\n");
        sb.append("   <Column ss:Width=\"140\"/>\n");
        sb.append("   <Column ss:Width=\"135\"/>\n");
        sb.append("   <Column ss:Width=\"120\"/>\n");
        sb.append("   <Column ss:Width=\"130\"/>\n");
        sb.append("   <Column ss:Width=\"160\"/>\n");
        sb.append("   <Column ss:Width=\"120\"/>\n");
        sb.append("   <Column ss:Width=\"130\"/>\n");
        sb.append("   <Column ss:Width=\"160\"/>\n");
        sb.append("   <Column ss:Width=\"120\"/>\n");
        sb.append("   <Column ss:Width=\"90\"/>\n");
        sb.append("   <Column ss:Width=\"110\"/>\n");
        sb.append("   <Column ss:Width=\"260\"/>\n");
        sb.append("   <Row ss:Height=\"28\">\n");
        sb.append("    <Cell ss:MergeAcross=\"13\" ss:StyleID=\"sTitle\"><Data ss:Type=\"String\">PAYSONIC AUDIT TRAIL &amp; COMPLIANCE LEDGER</Data></Cell>\n");
        sb.append("   </Row>\n");
        sb.append("   <Row ss:Height=\"18\">\n");
        sb.append("    <Cell ss:MergeAcross=\"13\" ss:StyleID=\"sSubtitle\"><Data ss:Type=\"String\">Total Events: ").append(records.size()).append("   |   Export Time: ").append(escapeXml(fetchTimeStr)).append("</Data></Cell>\n");
        sb.append("   </Row>\n");
        sb.append("   <Row ss:Height=\"4\">\n");
        for (int i = 0; i < 14; i++) {
            sb.append("    <Cell ss:StyleID=\"sGreenBar\"><Data ss:Type=\"String\"></Data></Cell>\n");
        }
        sb.append("   </Row>\n");
        sb.append("   <Row ss:Height=\"26\">\n");
        sb.append("    <Cell ss:StyleID=\"sHeader\"><Data ss:Type=\"String\">Sr No</Data></Cell>\n");
        sb.append("    <Cell ss:StyleID=\"sHeader\"><Data ss:Type=\"String\">Event ID</Data></Cell>\n");
        sb.append("    <Cell ss:StyleID=\"sHeader\"><Data ss:Type=\"String\">Timestamp</Data></Cell>\n");
        sb.append("    <Cell ss:StyleID=\"sHeader\"><Data ss:Type=\"String\">Actor Name</Data></Cell>\n");
        sb.append("    <Cell ss:StyleID=\"sHeader\"><Data ss:Type=\"String\">Actor Role</Data></Cell>\n");
        sb.append("    <Cell ss:StyleID=\"sHeader\"><Data ss:Type=\"String\">Module</Data></Cell>\n");
        sb.append("    <Cell ss:StyleID=\"sHeader\"><Data ss:Type=\"String\">Action</Data></Cell>\n");
        sb.append("    <Cell ss:StyleID=\"sHeader\"><Data ss:Type=\"String\">Reference ID</Data></Cell>\n");
        sb.append("    <Cell ss:StyleID=\"sHeader\"><Data ss:Type=\"String\">Correlation ID</Data></Cell>\n");
        sb.append("    <Cell ss:StyleID=\"sHeader\"><Data ss:Type=\"String\">Target</Data></Cell>\n");
        sb.append("    <Cell ss:StyleID=\"sHeader\"><Data ss:Type=\"String\">Plaza Scope</Data></Cell>\n");
        sb.append("    <Cell ss:StyleID=\"sHeader\"><Data ss:Type=\"String\">Outcome</Data></Cell>\n");
        sb.append("    <Cell ss:StyleID=\"sHeader\"><Data ss:Type=\"String\">IP Address</Data></Cell>\n");
        sb.append("    <Cell ss:StyleID=\"sHeader\"><Data ss:Type=\"String\">Details</Data></Cell>\n");
        sb.append("   </Row>\n");

        int idx = 1;
        for (AuditLogResponseDTO r : records) {
            String status = r.getStatus() != null ? r.getStatus().toUpperCase() : "SUCCESS";
            String statusStyle = "FAILURE".equals(status) ? "sFailure" : "WARNING".equals(status) ? "sWarning" : "sSuccess";
            String tsStr = r.getTimestamp() != null ? r.getTimestamp().format(dtf) : "—";
            String actorName = r.getActor() != null ? r.getActor().getName() : "";
            String actorRole = r.getActor() != null ? r.getActor().getRole() : "";
            String actorIp = r.getActor() != null ? r.getActor().getIpAddress() : "127.0.0.1";

            sb.append("   <Row ss:Height=\"20\">\n");
            sb.append("    <Cell ss:StyleID=\"sDataCenter\"><Data ss:Type=\"Number\">").append(idx++).append("</Data></Cell>\n");
            sb.append("    <Cell ss:StyleID=\"sDataCenter\"><Data ss:Type=\"String\">").append(escapeXml(r.getId())).append("</Data></Cell>\n");
            sb.append("    <Cell ss:StyleID=\"sDataCenter\"><Data ss:Type=\"String\">").append(escapeXml(tsStr)).append("</Data></Cell>\n");
            sb.append("    <Cell ss:StyleID=\"sDataText\"><Data ss:Type=\"String\">").append(escapeXml(actorName)).append("</Data></Cell>\n");
            sb.append("    <Cell ss:StyleID=\"sDataCenter\"><Data ss:Type=\"String\">").append(escapeXml(actorRole)).append("</Data></Cell>\n");
            sb.append("    <Cell ss:StyleID=\"sDataText\"><Data ss:Type=\"String\">").append(escapeXml(r.getModule())).append("</Data></Cell>\n");
            sb.append("    <Cell ss:StyleID=\"sDataText\"><Data ss:Type=\"String\">").append(escapeXml(r.getActionLabel() != null ? r.getActionLabel() : r.getAction())).append("</Data></Cell>\n");
            sb.append("    <Cell ss:StyleID=\"sDataCenter\"><Data ss:Type=\"String\">").append(escapeXml(r.getReferenceId())).append("</Data></Cell>\n");
            sb.append("    <Cell ss:StyleID=\"sDataCenter\"><Data ss:Type=\"String\">").append(escapeXml(r.getCorrelationId())).append("</Data></Cell>\n");
            sb.append("    <Cell ss:StyleID=\"sDataText\"><Data ss:Type=\"String\">").append(escapeXml(r.getTarget())).append("</Data></Cell>\n");
            sb.append("    <Cell ss:StyleID=\"sDataText\"><Data ss:Type=\"String\">").append(escapeXml(r.getPlaza())).append("</Data></Cell>\n");
            sb.append("    <Cell ss:StyleID=\"").append(statusStyle).append("\"><Data ss:Type=\"String\">").append(escapeXml(status)).append("</Data></Cell>\n");
            sb.append("    <Cell ss:StyleID=\"sDataCenter\"><Data ss:Type=\"String\">").append(escapeXml(actorIp)).append("</Data></Cell>\n");
            sb.append("    <Cell ss:StyleID=\"sDataText\"><Data ss:Type=\"String\">").append(escapeXml(r.getDetails())).append("</Data></Cell>\n");
            sb.append("   </Row>\n");
        }

        sb.append("  </Table>\n");
        sb.append(" </Worksheet>\n");
        sb.append("</Workbook>");
        return sb.toString();
    }

    @Transactional
    public LoginHistory recordLoginAttempt(LoginHistory record) {
        if (record.getTimestamp() == null) {
            record.setTimestamp(LocalDateTime.now());
        }
        return loginHistoryRepository.save(record);
    }

    @Transactional
    public AuditLogResponseDTO recordAuditEvent(AuditLogRequestDTO req) {
        String eventId = req.getId() != null && !req.getId().isBlank()
                ? req.getId()
                : "AUD-" + String.valueOf(System.currentTimeMillis()).substring(7);
        LocalDateTime ts = req.getTimestamp() != null ? req.getTimestamp() : LocalDateTime.now();
        String beforeStr = null;
        String afterStr = null;
        try {
            if (req.getBefore() != null) {
                beforeStr = req.getBefore() instanceof String ? (String) req.getBefore() : objectMapper.writeValueAsString(req.getBefore());
            }
            if (req.getAfter() != null) {
                afterStr = req.getAfter() instanceof String ? (String) req.getAfter() : objectMapper.writeValueAsString(req.getAfter());
            }
        } catch (Exception ignored) {}

        AuditLog log = new AuditLog(
                eventId,
                ts,
                req.getModule() != null ? req.getModule() : "System",
                req.getAction() != null ? req.getAction() : "AUDIT_ACTION",
                req.getActionLabel() != null ? req.getActionLabel() : "Action Executed",
                req.getStatus() != null ? req.getStatus() : "SUCCESS",
                req.getActorId() != null ? req.getActorId() : "PSN0005",
                req.getActorName() != null ? req.getActorName() : "Sanjay Kulkarni",
                req.getActorRole() != null ? req.getActorRole() : "Master Admin",
                req.getActorIp() != null ? req.getActorIp() : "127.0.0.1",
                req.getPlaza() != null ? req.getPlaza() : "All plazas",
                req.getTarget() != null ? req.getTarget() : "General",
                req.getReferenceId() != null ? req.getReferenceId() : "REF-" + System.currentTimeMillis(),
                req.getCorrelationId() != null ? req.getCorrelationId() : "CORR-" + System.currentTimeMillis(),
                req.getDetails() != null ? req.getDetails() : "",
                beforeStr,
                afterStr
        );
        AuditLog saved = auditLogRepository.save(log);
        return AuditLogResponseDTO.fromEntity(saved, objectMapper);
    }
}

