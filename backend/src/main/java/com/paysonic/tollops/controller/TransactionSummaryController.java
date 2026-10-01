package com.paysonic.tollops.controller;

import com.paysonic.tollops.aspect.Auditable;
import com.paysonic.tollops.dto.TransactionSummaryResponseDTO;
import com.paysonic.tollops.service.TransactionSummaryService;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Map;

@RestController
@RequestMapping("/api/summary/transaction-summary")
@CrossOrigin(origins = "*")
public class TransactionSummaryController {

    private static final Logger log = LoggerFactory.getLogger(TransactionSummaryController.class);
    private final TransactionSummaryService service;

    public TransactionSummaryController(TransactionSummaryService service) {
        this.service = service;
    }

    @PostMapping("/search")
    public ResponseEntity<?> search(@RequestBody Map<String, Object> body) {
        try {
            LocalDate fromDate = parseLocalDate(body.get("fromDate"));
            LocalDate toDate = parseLocalDate(body.get("toDate"));
            String plazaId = (String) body.get("plazaId");
            String status = (String) body.get("status");

            if (fromDate == null) fromDate = LocalDate.of(2026, 9, 1);
            if (toDate == null) toDate = LocalDate.of(2026, 9, 30);

            TransactionSummaryResponseDTO report = service.generateReport(fromDate, toDate, plazaId, status);
            return ResponseEntity.ok(report);
        } catch (Exception ex) {
            log.error("Error generating Transaction Summary Report: {}", ex.getMessage(), ex);
            return ResponseEntity.internalServerError().body(Map.of("error", ex.getMessage()));
        }
    }

    @PostMapping("/export")
    @Auditable(module = "Summary Report", action = "EXPORT_TRANSACTION_SUMMARY_EXCEL", actionLabel = "Exported Transaction Summary Report (Excel)", target = "Transaction Summary Report")
    public void exportExcel(@RequestBody Map<String, Object> body, HttpServletResponse response) {
        try {
            LocalDate fromDate = parseLocalDate(body.get("fromDate"));
            LocalDate toDate = parseLocalDate(body.get("toDate"));
            String plazaId = (String) body.get("plazaId");
            String status = (String) body.get("status");

            if (fromDate == null) fromDate = LocalDate.of(2026, 9, 1);
            if (toDate == null) toDate = LocalDate.of(2026, 9, 30);

            String fileName = "Transaction_Summary_Report_" + System.currentTimeMillis() + ".xlsx";
            response.setContentType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
            response.setHeader("Content-Disposition", "attachment; filename=\"" + fileName + "\"");

            service.streamExcelExport(fromDate, toDate, plazaId, status, response.getOutputStream());
            response.flushBuffer();
        } catch (Exception ex) {
            log.error("Error exporting Transaction Summary Report Excel: {}", ex.getMessage(), ex);
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
        }
    }

    @PostMapping("/export/csv")
    @Auditable(module = "Summary Report", action = "EXPORT_TRANSACTION_SUMMARY_CSV", actionLabel = "Exported Transaction Summary Report (CSV)", target = "Transaction Summary Report")
    public void exportCsv(@RequestBody Map<String, Object> body, HttpServletResponse response) {
        try {
            LocalDate fromDate = parseLocalDate(body.get("fromDate"));
            LocalDate toDate = parseLocalDate(body.get("toDate"));
            String plazaId = (String) body.get("plazaId");
            String status = (String) body.get("status");

            if (fromDate == null) fromDate = LocalDate.of(2026, 9, 1);
            if (toDate == null) toDate = LocalDate.of(2026, 9, 30);

            String fileName = "Transaction_Summary_Report_" + System.currentTimeMillis() + ".csv";
            response.setContentType("text/csv; charset=UTF-8");
            response.setHeader("Content-Disposition", "attachment; filename=\"" + fileName + "\"");

            service.streamCsvExport(fromDate, toDate, plazaId, status, response.getOutputStream());
            response.flushBuffer();
        } catch (Exception ex) {
            log.error("Error exporting Transaction Summary Report CSV: {}", ex.getMessage(), ex);
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
        }
    }

    private LocalDate parseLocalDate(Object obj) {
        if (obj == null) return null;
        String str = obj.toString().trim();
        if (str.isEmpty()) return null;
        try {
            if (str.contains("T")) {
                str = str.substring(0, str.indexOf("T"));
            } else if (str.contains(" ")) {
                str = str.substring(0, str.indexOf(" "));
            }
            if (str.contains("-") && str.indexOf("-") == 4) {
                return LocalDate.parse(str, DateTimeFormatter.ISO_LOCAL_DATE);
            }
            if (str.contains("-")) {
                return LocalDate.parse(str, DateTimeFormatter.ofPattern("dd-MM-yyyy"));
            }
            return LocalDate.parse(str);
        } catch (Exception e) {
            log.warn("Failed to parse local date: {}", str);
            return null;
        }
    }
}
