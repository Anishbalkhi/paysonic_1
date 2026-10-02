package com.paysonic.tollops.controller;

import com.paysonic.tollops.aspect.Auditable;
import com.paysonic.tollops.entity.DisputeTransaction;
import com.paysonic.tollops.service.DisputeReportService;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Map;

@RestController
@RequestMapping("/api/disputes")
@CrossOrigin(origins = "*")
public class DisputeReportController {

    private static final Logger log = LoggerFactory.getLogger(DisputeReportController.class);
    private final DisputeReportService disputeReportService;

    public DisputeReportController(DisputeReportService disputeReportService) {
        this.disputeReportService = disputeReportService;
    }

    @GetMapping("/search")
    public ResponseEntity<?> search(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime fromDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime toDate,
            @RequestParam(required = false) String plazaId,
            @RequestParam(required = false) String functionCode,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size) {

        try {
            LocalDateTime effectiveFrom = fromDate != null ? fromDate : LocalDateTime.now().minusDays(30).withHour(0).withMinute(0).withSecond(0);
            LocalDateTime effectiveTo = toDate != null ? toDate : LocalDateTime.now().withHour(23).withMinute(59).withSecond(59);

            validateDateRange(effectiveFrom, effectiveTo);

            Page<DisputeTransaction> results = disputeReportService.searchDisputes(
                    effectiveFrom,
                    effectiveTo,
                    plazaId,
                    functionCode,
                    PageRequest.of(page, Math.min(size, 100), Sort.by(Sort.Direction.DESC, "txnDateTime"))
            );

            return ResponseEntity.ok(results);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        } catch (Exception ex) {
            log.error("Error executing Dispute Report search: {}", ex.getMessage(), ex);
            return ResponseEntity.internalServerError().body(Map.of("error", "Error searching dispute records: " + ex.getMessage()));
        }
    }

    @GetMapping({"/export", "/export/excel"})
    @Auditable(module = "Dispute Handling", action = "EXPORT_DISPUTE_EXCEL", actionLabel = "Exported Dispute Detail Report (Excel)", target = "Dispute Detail Report")
    public void exportExcel(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime fromDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime toDate,
            @RequestParam(required = false) String plazaId,
            @RequestParam(required = false) String functionCode,
            HttpServletResponse response) {

        try {
            LocalDateTime effectiveFrom = fromDate != null ? fromDate : LocalDateTime.now().minusDays(30).withHour(0).withMinute(0).withSecond(0);
            LocalDateTime effectiveTo = toDate != null ? toDate : LocalDateTime.now().withHour(23).withMinute(59).withSecond(59);

            validateDateRange(effectiveFrom, effectiveTo);

            String fileName = "Dispute_Detail_Report_" + System.currentTimeMillis() + ".xlsx";
            response.setContentType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
            response.setHeader("Content-Disposition", "attachment; filename=\"" + fileName + "\"");

            disputeReportService.streamExcelExport(effectiveFrom, effectiveTo, plazaId, functionCode, response.getOutputStream());
            response.flushBuffer();
        } catch (IllegalArgumentException ex) {
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
        } catch (Exception ex) {
            log.error("Error exporting Dispute Detail Report Excel: {}", ex.getMessage(), ex);
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
        }
    }

    @GetMapping("/export/csv")
    @Auditable(module = "Dispute Handling", action = "EXPORT_DISPUTE_CSV", actionLabel = "Exported Dispute Detail Report (CSV)", target = "Dispute Detail Report")
    public void exportCsv(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime fromDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime toDate,
            @RequestParam(required = false) String plazaId,
            @RequestParam(required = false) String functionCode,
            HttpServletResponse response) {

        try {
            LocalDateTime effectiveFrom = fromDate != null ? fromDate : LocalDateTime.now().minusDays(30).withHour(0).withMinute(0).withSecond(0);
            LocalDateTime effectiveTo = toDate != null ? toDate : LocalDateTime.now().withHour(23).withMinute(59).withSecond(59);

            validateDateRange(effectiveFrom, effectiveTo);

            String fileName = "Dispute_Detail_Report_" + System.currentTimeMillis() + ".csv";
            response.setContentType("text/csv; charset=UTF-8");
            response.setHeader("Content-Disposition", "attachment; filename=\"" + fileName + "\"");

            disputeReportService.streamCsvExport(effectiveFrom, effectiveTo, plazaId, functionCode, response.getOutputStream());
            response.flushBuffer();
        } catch (IllegalArgumentException ex) {
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
        } catch (Exception ex) {
            log.error("Error exporting Dispute Detail Report CSV: {}", ex.getMessage(), ex);
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
        }
    }

    private void validateDateRange(LocalDateTime from, LocalDateTime to) {
        if (from.isAfter(to)) {
            throw new IllegalArgumentException("From Date must be earlier than or equal to To Date");
        }
    }
}
