package com.paysonic.tollops.controller;

import com.paysonic.tollops.aspect.Auditable;
import com.paysonic.tollops.entity.ViolationTransaction;
import com.paysonic.tollops.service.ViolationBulkActionService;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/violation/bulk-action")
@CrossOrigin(origins = "*")
public class ViolationBulkActionController {

    private static final Logger log = LoggerFactory.getLogger(ViolationBulkActionController.class);
    private final ViolationBulkActionService service;

    public ViolationBulkActionController(ViolationBulkActionService service) {
        this.service = service;
    }

    @PostMapping("/search")
    public ResponseEntity<?> search(@RequestBody Map<String, Object> body) {
        try {
            LocalDateTime fromDate = parseDateTime(body.get("fromDate"));
            LocalDateTime toDate = parseDateTime(body.get("toDate"));
            String plazaId = (String) body.get("plazaId");
            String apiStatus = (String) body.get("apiStatus");
            String vrn = (String) body.get("vrn");
            String tagId = (String) body.get("tagId");
            String acqTxnId = (String) body.get("acqTxnId");

            int page = body.get("page") != null ? ((Number) body.get("page")).intValue() : 0;
            int size = body.get("size") != null ? ((Number) body.get("size")).intValue() : 50;

            if (fromDate == null) fromDate = LocalDateTime.of(2026, 9, 1, 0, 0, 0);
            if (toDate == null) toDate = LocalDateTime.of(2026, 9, 30, 23, 59, 59);

            Page<ViolationTransaction> pageResult = service.searchViolations(
                    fromDate, toDate, plazaId, apiStatus, vrn, tagId, acqTxnId,
                    PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "txnDateTime"))
            );

            Map<String, Object> summary = service.calculateSummary(
                    fromDate, toDate, plazaId, apiStatus, vrn, tagId, acqTxnId
            );

            Map<String, Object> response = new HashMap<>();
            response.put("content", pageResult.getContent());
            response.put("totalElements", pageResult.getTotalElements());
            response.put("totalPages", pageResult.getTotalPages());
            response.put("number", pageResult.getNumber());
            response.put("size", pageResult.getSize());
            response.put("summary", summary);

            return ResponseEntity.ok(response);
        } catch (Exception ex) {
            log.error("Error executing Violation Bulk Action search: {}", ex.getMessage(), ex);
            return ResponseEntity.internalServerError().body(Map.of("error", ex.getMessage()));
        }
    }

    @PostMapping("/apply")
    @Auditable(module = "Violation Management", action = "EXECUTE_VIOLATION_BULK_ACTION", actionLabel = "Executed Violation Bulk Action", target = "Violation Bulk Action")
    public ResponseEntity<?> applyBulkAction(@RequestBody Map<String, Object> body) {
        try {
            @SuppressWarnings("unchecked")
            List<Object> rawIds = (List<Object>) body.get("ids");
            if (rawIds == null || rawIds.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("error", "No records selected for bulk action"));
            }

            List<Long> ids = rawIds.stream()
                    .map(o -> Long.parseLong(o.toString()))
                    .toList();

            String action = (String) body.get("action");
            String remarks = (String) body.get("remarks");

            Map<String, Object> result = service.applyBulkAction(ids, action, remarks);
            return ResponseEntity.ok(result);
        } catch (Exception ex) {
            log.error("Error executing Violation Bulk Action: {}", ex.getMessage(), ex);
            return ResponseEntity.internalServerError().body(Map.of("error", ex.getMessage()));
        }
    }

    @PostMapping("/export")
    @Auditable(module = "Violation Management", action = "EXPORT_VIOLATION_BULK_ACTION_EXCEL", actionLabel = "Exported Violation Bulk Action (Excel)", target = "Violation Bulk Action")
    public void exportExcel(@RequestBody Map<String, Object> body, HttpServletResponse response) {
        try {
            LocalDateTime fromDate = parseDateTime(body.get("fromDate"));
            LocalDateTime toDate = parseDateTime(body.get("toDate"));
            String plazaId = (String) body.get("plazaId");
            String apiStatus = (String) body.get("apiStatus");
            String vrn = (String) body.get("vrn");
            String tagId = (String) body.get("tagId");
            String acqTxnId = (String) body.get("acqTxnId");

            if (fromDate == null) fromDate = LocalDateTime.of(2026, 9, 1, 0, 0, 0);
            if (toDate == null) toDate = LocalDateTime.of(2026, 9, 30, 23, 59, 59);

            String fileName = "Violation_Bulk_Action_" + System.currentTimeMillis() + ".xlsx";
            response.setContentType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
            response.setHeader("Content-Disposition", "attachment; filename=\"" + fileName + "\"");

            service.streamExcelExport(fromDate, toDate, plazaId, apiStatus, vrn, tagId, acqTxnId, response.getOutputStream());
            response.flushBuffer();
        } catch (Exception ex) {
            log.error("Error exporting Violation Bulk Action Excel: {}", ex.getMessage(), ex);
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
        }
    }

    @PostMapping("/export/csv")
    @Auditable(module = "Violation Management", action = "EXPORT_VIOLATION_BULK_ACTION_CSV", actionLabel = "Exported Violation Bulk Action (CSV)", target = "Violation Bulk Action")
    public void exportCsv(@RequestBody Map<String, Object> body, HttpServletResponse response) {
        try {
            LocalDateTime fromDate = parseDateTime(body.get("fromDate"));
            LocalDateTime toDate = parseDateTime(body.get("toDate"));
            String plazaId = (String) body.get("plazaId");
            String apiStatus = (String) body.get("apiStatus");
            String vrn = (String) body.get("vrn");
            String tagId = (String) body.get("tagId");
            String acqTxnId = (String) body.get("acqTxnId");

            if (fromDate == null) fromDate = LocalDateTime.of(2026, 9, 1, 0, 0, 0);
            if (toDate == null) toDate = LocalDateTime.of(2026, 9, 30, 23, 59, 59);

            String fileName = "Violation_Bulk_Action_" + System.currentTimeMillis() + ".csv";
            response.setContentType("text/csv; charset=UTF-8");
            response.setHeader("Content-Disposition", "attachment; filename=\"" + fileName + "\"");

            service.streamCsvExport(fromDate, toDate, plazaId, apiStatus, vrn, tagId, acqTxnId, response.getOutputStream());
            response.flushBuffer();
        } catch (Exception ex) {
            log.error("Error exporting Violation Bulk Action CSV: {}", ex.getMessage(), ex);
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
        }
    }

    private LocalDateTime parseDateTime(Object obj) {
        if (obj == null) return null;
        String str = obj.toString().trim();
        if (str.isEmpty()) return null;
        try {
            if (str.contains("T")) {
                return LocalDateTime.parse(str, DateTimeFormatter.ISO_LOCAL_DATE_TIME);
            }
            if (str.contains(" ")) {
                return LocalDateTime.parse(str, DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));
            }
            return LocalDateTime.parse(str + "T00:00:00");
        } catch (Exception e) {
            log.warn("Failed to parse date: {}", str);
            return null;
        }
    }
}
