package com.paysonic.tollops.controller;

import com.paysonic.tollops.aspect.Auditable;
import com.paysonic.tollops.entity.TollTransaction;
import com.paysonic.tollops.service.TrsReportService;
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
@RequestMapping("/api/reports/trs")
@CrossOrigin(origins = "*")
public class TrsReportController {

    private static final Logger log = LoggerFactory.getLogger(TrsReportController.class);
    private final TrsReportService trsReportService;

    public TrsReportController(TrsReportService trsReportService) {
        this.trsReportService = trsReportService;
    }

    @GetMapping("/search")
    public ResponseEntity<?> search(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime fromDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime toDate,
            @RequestParam(required = false) String plazaId,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size) {

        try {
            LocalDateTime effectiveFrom = fromDate != null ? fromDate : LocalDateTime.now().withHour(0).withMinute(0).withSecond(1);
            LocalDateTime effectiveTo = toDate != null ? toDate : LocalDateTime.now().withHour(23).withMinute(59).withSecond(59);

            validateDateRange(effectiveFrom, effectiveTo);

            Page<TollTransaction> results = trsReportService.searchTransactions(
                    effectiveFrom,
                    effectiveTo,
                    plazaId,
                    status,
                    PageRequest.of(page, Math.min(size, 100), Sort.by(Sort.Direction.DESC, "txnDate"))
            );

            return ResponseEntity.ok(results);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        } catch (Exception ex) {
            log.error("Error executing TRS search: {}", ex.getMessage(), ex);
            return ResponseEntity.internalServerError().body(Map.of("error", "Error searching transactions: " + ex.getMessage()));
        }
    }

    @GetMapping({"/export", "/excel"})
    @Auditable(module = "Transactional Reports", action = "EXPORT_TRANSACTION_REPORT_EXCEL", actionLabel = "Exported Transaction Report (Excel)", target = "Transaction Report")
    public void exportExcel(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime fromDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime toDate,
            @RequestParam(required = false) String plazaId,
            @RequestParam(required = false) String status,
            HttpServletResponse response) {

        try {
            LocalDateTime effectiveFrom = fromDate != null ? fromDate : LocalDateTime.now().withHour(0).withMinute(0).withSecond(1);
            LocalDateTime effectiveTo = toDate != null ? toDate : LocalDateTime.now().withHour(23).withMinute(59).withSecond(59);

            validateDateRange(effectiveFrom, effectiveTo);

            String fileName = "Transaction_Report_" + System.currentTimeMillis() + ".xlsx";
            response.setContentType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
            response.setHeader("Content-Disposition", "attachment; filename=\"" + fileName + "\"");

            trsReportService.streamExcelExport(effectiveFrom, effectiveTo, plazaId, status, response.getOutputStream());
            response.flushBuffer();
        } catch (IllegalArgumentException ex) {
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
        } catch (Exception ex) {
            log.error("Error exporting Transaction Report Excel: {}", ex.getMessage(), ex);
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
        }
    }

    @GetMapping({"/export/csv", "/csv"})
    @Auditable(module = "Transactional Reports", action = "EXPORT_TRANSACTION_REPORT_CSV", actionLabel = "Exported Transaction Report (CSV)", target = "Transaction Report")
    public void exportCsv(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime fromDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime toDate,
            @RequestParam(required = false) String plazaId,
            @RequestParam(required = false) String status,
            HttpServletResponse response) {

        try {
            LocalDateTime effectiveFrom = fromDate != null ? fromDate : LocalDateTime.now().withHour(0).withMinute(0).withSecond(1);
            LocalDateTime effectiveTo = toDate != null ? toDate : LocalDateTime.now().withHour(23).withMinute(59).withSecond(59);

            validateDateRange(effectiveFrom, effectiveTo);

            String fileName = "Transaction_Report_" + System.currentTimeMillis() + ".csv";
            response.setContentType("text/csv; charset=UTF-8");
            response.setHeader("Content-Disposition", "attachment; filename=\"" + fileName + "\"");

            trsReportService.streamCsvExport(effectiveFrom, effectiveTo, plazaId, status, response.getOutputStream());
            response.flushBuffer();
        } catch (IllegalArgumentException ex) {
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
        } catch (Exception ex) {
            log.error("Error exporting Transaction Report CSV: {}", ex.getMessage(), ex);
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
        }
    }

    private void validateDateRange(LocalDateTime from, LocalDateTime to) {
        if (from.isAfter(to)) {
            throw new IllegalArgumentException("From Date must be earlier than or equal to To Date");
        }
        if (Duration.between(from, to).toDays() > 90) {
            throw new IllegalArgumentException("Selected date range exceeds maximum allowed limit of 90 days");
        }
    }
}
