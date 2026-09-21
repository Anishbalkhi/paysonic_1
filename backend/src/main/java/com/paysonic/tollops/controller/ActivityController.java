package com.paysonic.tollops.controller;

import com.paysonic.tollops.dto.*;
import com.paysonic.tollops.entity.LoginHistory;
import com.paysonic.tollops.entity.UserSession;
import com.paysonic.tollops.service.ActivityService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/activity")
@CrossOrigin(origins = "*")
public class ActivityController {

    private final ActivityService activityService;

    public ActivityController(ActivityService activityService) {
        this.activityService = activityService;
    }

    @GetMapping("/stats")
    public ResponseEntity<DashboardStatsDTO> getStats() {
        return ResponseEntity.ok(activityService.getDashboardStats());
    }

    @GetMapping("/login-trend")
    public ResponseEntity<LoginTrendDTO> getLoginTrend(@RequestParam(value = "days", defaultValue = "7") int days) {
        return ResponseEntity.ok(activityService.getLoginTrend(days));
    }

    @GetMapping("/module-breakdown")
    public ResponseEntity<List<ModuleBreakdownDTO>> getModuleBreakdown() {
        return ResponseEntity.ok(activityService.getModuleBreakdown());
    }

    @GetMapping("/recent")
    public ResponseEntity<List<AuditLogResponseDTO>> getRecentActivity(@RequestParam(value = "limit", defaultValue = "10") int limit) {
        return ResponseEntity.ok(activityService.getRecentActivity(limit));
    }

    @GetMapping("/active-users")
    public ResponseEntity<List<UserSession>> getActiveUsers() {
        return ResponseEntity.ok(activityService.getActiveSessions());
    }

    @PostMapping("/sessions/{sessionId}/terminate")
    public ResponseEntity<Map<String, Object>> forceLogout(
            @PathVariable String sessionId,
            @RequestBody(required = false) ForceLogoutRequest request,
            @RequestHeader(value = "X-Actor-ID", required = false, defaultValue = "PSN0005") String actorId,
            HttpServletRequest httpRequest) {
        String reason = (request != null && request.getReason() != null) ? request.getReason() : "Administrative revocation";
        String ip = httpRequest != null ? httpRequest.getRemoteAddr() : "127.0.0.1";
        return ResponseEntity.ok(activityService.forceLogout(sessionId, reason, actorId, ip));
    }

    @GetMapping("/login-history")
    public ResponseEntity<List<LoginHistory>> getLoginHistory(@RequestParam(value = "status", required = false) String status) {
        return ResponseEntity.ok(activityService.getLoginHistory(status));
    }

    @GetMapping("/audit-log")
    public ResponseEntity<List<AuditLogResponseDTO>> getAuditLog(
            @RequestParam(value = "search", required = false) String search,
            @RequestParam(value = "module", required = false) String module,
            @RequestParam(value = "status", required = false) String status,
            @RequestParam(value = "plaza", required = false) String plaza,
            @RequestParam(value = "actorId", required = false) String actorId,
            @RequestParam(value = "dateRange", required = false) String dateRange) {
        AuditFilterRequest filters = new AuditFilterRequest();
        filters.setSearch(search);
        filters.setModule(module);
        filters.setStatus(status);
        filters.setPlaza(plaza);
        filters.setActorId(actorId);
        filters.setDateRange(dateRange);

        return ResponseEntity.ok(activityService.getAuditLog(filters));
    }

    @GetMapping("/export")
    public ResponseEntity<ExportResponseDTO> exportAudit(
            @RequestParam(value = "format", defaultValue = "csv") String format,
            @RequestParam(value = "search", required = false) String search,
            @RequestParam(value = "module", required = false) String module,
            @RequestParam(value = "status", required = false) String status,
            @RequestParam(value = "plaza", required = false) String plaza,
            @RequestHeader(value = "X-Actor-ID", required = false, defaultValue = "PSN0005") String actorId,
            HttpServletRequest httpRequest) {
        AuditFilterRequest filters = new AuditFilterRequest();
        filters.setFormat(format);
        filters.setSearch(search);
        filters.setModule(module);
        filters.setStatus(status);
        filters.setPlaza(plaza);

        String ip = httpRequest != null ? httpRequest.getRemoteAddr() : "127.0.0.1";
        ExportResponseDTO export = activityService.exportAudit(filters, actorId, ip);
        return ResponseEntity.ok(export);
    }
}
