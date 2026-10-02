package com.paysonic.tollops.controller;

import com.paysonic.tollops.aspect.Auditable;
import com.paysonic.tollops.entity.DisputeTransaction;
import com.paysonic.tollops.service.TransactionSearchDisputeService;
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
@RequestMapping("/api/reports/transaction-search/dispute")
@CrossOrigin(origins = "*")
public class TransactionSearchDisputeController {

    private static final Logger log = LoggerFactory.getLogger(TransactionSearchDisputeController.class);
    private final TransactionSearchDisputeService service;

    public TransactionSearchDisputeController(TransactionSearchDisputeService service) {
        this.service = service;
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

            Page<DisputeTransaction> results = service.searchDisputes(
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
            log.error("Error executing Transaction Search Dispute: {}", ex.getMessage(), ex);
            return ResponseEntity.internalServerError().body(Map.of("error", "Error searching dispute records: " + ex.getMessage()));
        }
    }

    @GetMapping({"/export", "/excel"})
    @Auditable(module = "Transactional Reports", action = "EXPORT_TRANSACTION_SEARCH_DISPUTE_EXCEL", actionLabel = "Exported Transaction Search Dispute (Excel)", target = "Transaction Search - Dispute Transaction")
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

            String fileName = "Transaction_Search_Dispute_" + System.currentTimeMillis() + ".xlsx";
            response.setContentType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
            response.setHeader("Content-Disposition", "attachment; filename=\"" + fileName + "\"");

            service.streamExcelExport(effectiveFrom, effectiveTo, plazaId, functionCode, response.getOutputStream());
            response.flushBuffer();
        } catch (IllegalArgumentException ex) {
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
        } catch (Exception ex) {
            log.error("Error exporting Transaction Search Dispute Excel: {}", ex.getMessage(), ex);
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
        }
    }

    @GetMapping({"/export/csv", "/csv"})
    @Auditable(module = "Transactional Reports", action = "EXPORT_TRANSACTION_SEARCH_DISPUTE_CSV", actionLabel = "Exported Transaction Search Dispute (CSV)", target = "Transaction Search - Dispute Transaction")
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

            String fileName = "Transaction_Search_Dispute_" + System.currentTimeMillis() + ".csv";
            response.setContentType("text/csv; charset=UTF-8");
            response.setHeader("Content-Disposition", "attachment; filename=\"" + fileName + "\"");

            service.streamCsvExport(effectiveFrom, effectiveTo, plazaId, functionCode, response.getOutputStream());
            response.flushBuffer();
        } catch (IllegalArgumentException ex) {
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
        } catch (Exception ex) {
            log.error("Error exporting Transaction Search Dispute CSV: {}", ex.getMessage(), ex);
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
        }
    }

    private void validateDateRange(LocalDateTime from, LocalDateTime to) {
        if (from.isAfter(to)) {
            throw new IllegalArgumentException("From Date must be earlier than or equal to To Date");
        }
    }
}
