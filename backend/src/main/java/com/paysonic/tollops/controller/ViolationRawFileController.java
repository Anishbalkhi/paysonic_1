package com.paysonic.tollops.controller;

import com.paysonic.tollops.aspect.Auditable;
import com.paysonic.tollops.entity.ViolationRawRecord;
import com.paysonic.tollops.service.ViolationRawFileService;
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
import java.util.Map;

@RestController
@RequestMapping("/api/violation/raw-file")
@CrossOrigin(origins = "*")
public class ViolationRawFileController {

    private static final Logger log = LoggerFactory.getLogger(ViolationRawFileController.class);
    private final ViolationRawFileService service;

    public ViolationRawFileController(ViolationRawFileService service) {
        this.service = service;
    }

    @PostMapping("/search")
    public ResponseEntity<?> search(@RequestBody Map<String, Object> body) {
        try {
            LocalDateTime fromDate = parseDateTime(body.get("fromDate"));
            LocalDateTime toDate = parseDateTime(body.get("toDate"));
            String plazaId = (String) body.get("plazaId");
            String functionCode = (String) body.get("functionCode");
            String tagId = (String) body.get("tagId");
            String txnId = (String) body.get("txnId");
            String mmt = (String) body.get("mmt");

            int page = body.get("page") != null ? ((Number) body.get("page")).intValue() : 0;
            int size = body.get("size") != null ? ((Number) body.get("size")).intValue() : 50;

            if (fromDate == null) fromDate = LocalDateTime.of(2026, 9, 1, 0, 0, 0);
            if (toDate == null) toDate = LocalDateTime.of(2026, 9, 30, 23, 59, 59);

            Page<ViolationRawRecord> pageResult = service.searchRecords(
                    fromDate, toDate, plazaId, functionCode, tagId, txnId, mmt,
                    PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "parsedDateTime"))
            );

            Map<String, Object> summary = service.calculateSummary(
                    fromDate, toDate, plazaId, functionCode, tagId, txnId, mmt
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
            log.error("Error executing Violation Raw File search: {}", ex.getMessage(), ex);
            return ResponseEntity.internalServerError().body(Map.of("error", ex.getMessage()));
        }
    }

    @PostMapping("/export")
    @Auditable(module = "Violation Management", action = "EXPORT_VIOLATION_RAW_FILE_EXCEL", actionLabel = "Exported Violation Raw File (Excel)", target = "Violation Raw File Report")
    public void exportExcel(@RequestBody Map<String, Object> body, HttpServletResponse response) {
        try {
            LocalDateTime fromDate = parseDateTime(body.get("fromDate"));
            LocalDateTime toDate = parseDateTime(body.get("toDate"));
            String plazaId = (String) body.get("plazaId");
            String functionCode = (String) body.get("functionCode");
            String tagId = (String) body.get("tagId");
            String txnId = (String) body.get("txnId");
            String mmt = (String) body.get("mmt");

            if (fromDate == null) fromDate = LocalDateTime.of(2026, 9, 1, 0, 0, 0);
            if (toDate == null) toDate = LocalDateTime.of(2026, 9, 30, 23, 59, 59);

            String fileName = "Violation_Raw_File_" + System.currentTimeMillis() + ".xlsx";
            response.setContentType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
            response.setHeader("Content-Disposition", "attachment; filename=\"" + fileName + "\"");

            service.streamExcelExport(fromDate, toDate, plazaId, functionCode, tagId, txnId, mmt, response.getOutputStream());
            response.flushBuffer();
        } catch (Exception ex) {
            log.error("Error exporting Violation Raw File Excel: {}", ex.getMessage(), ex);
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
        }
    }

    @PostMapping("/export/csv")
    @Auditable(module = "Violation Management", action = "EXPORT_VIOLATION_RAW_FILE_CSV", actionLabel = "Exported Violation Raw File (CSV)", target = "Violation Raw File Report")
    public void exportCsv(@RequestBody Map<String, Object> body, HttpServletResponse response) {
        try {
            LocalDateTime fromDate = parseDateTime(body.get("fromDate"));
            LocalDateTime toDate = parseDateTime(body.get("toDate"));
            String plazaId = (String) body.get("plazaId");
            String functionCode = (String) body.get("functionCode");
            String tagId = (String) body.get("tagId");
            String txnId = (String) body.get("txnId");
            String mmt = (String) body.get("mmt");

            if (fromDate == null) fromDate = LocalDateTime.of(2026, 9, 1, 0, 0, 0);
            if (toDate == null) toDate = LocalDateTime.of(2026, 9, 30, 23, 59, 59);

            String fileName = "Violation_Raw_File_" + System.currentTimeMillis() + ".csv";
            response.setContentType("text/csv; charset=UTF-8");
            response.setHeader("Content-Disposition", "attachment; filename=\"" + fileName + "\"");

            service.streamCsvExport(fromDate, toDate, plazaId, functionCode, tagId, txnId, mmt, response.getOutputStream());
            response.flushBuffer();
        } catch (Exception ex) {
            log.error("Error exporting Violation Raw File CSV: {}", ex.getMessage(), ex);
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
        }
    }

    @PostMapping("/export/txt")
    @Auditable(module = "Violation Management", action = "EXPORT_VIOLATION_RAW_FILE_TXT", actionLabel = "Exported Violation Raw File (TXT)", target = "Violation Raw File Report")
    public void exportTxt(@RequestBody Map<String, Object> body, HttpServletResponse response) {
        try {
            LocalDateTime fromDate = parseDateTime(body.get("fromDate"));
            LocalDateTime toDate = parseDateTime(body.get("toDate"));
            String plazaId = (String) body.get("plazaId");
            String functionCode = (String) body.get("functionCode");
            String tagId = (String) body.get("tagId");
            String txnId = (String) body.get("txnId");
            String mmt = (String) body.get("mmt");

            if (fromDate == null) fromDate = LocalDateTime.of(2026, 9, 1, 0, 0, 0);
            if (toDate == null) toDate = LocalDateTime.of(2026, 9, 30, 23, 59, 59);

            String fileName = "Violation_Raw_File_" + System.currentTimeMillis() + ".txt";
            response.setContentType("text/plain; charset=UTF-8");
            response.setHeader("Content-Disposition", "attachment; filename=\"" + fileName + "\"");

            service.streamRawTextExport(fromDate, toDate, plazaId, functionCode, tagId, txnId, mmt, response.getOutputStream());
            response.flushBuffer();
        } catch (Exception ex) {
            log.error("Error exporting Violation Raw File TXT: {}", ex.getMessage(), ex);
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
