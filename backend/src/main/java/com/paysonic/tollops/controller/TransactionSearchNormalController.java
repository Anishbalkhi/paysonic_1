package com.paysonic.tollops.controller;

import com.paysonic.tollops.aspect.Auditable;
import com.paysonic.tollops.entity.TollTransaction;
import com.paysonic.tollops.service.TransactionSearchNormalService;
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
@RequestMapping("/api/reports/transaction-search/normal")
@CrossOrigin(origins = "*")
public class TransactionSearchNormalController {

    private static final Logger log = LoggerFactory.getLogger(TransactionSearchNormalController.class);
    private final TransactionSearchNormalService service;

    public TransactionSearchNormalController(TransactionSearchNormalService service) {
        this.service = service;
    }

    @PostMapping("/search")
    public ResponseEntity<?> search(@RequestBody Map<String, Object> body) {
        try {
            LocalDateTime fromDate = parseDateTime(body.get("fromDate"));
            LocalDateTime toDate = parseDateTime(body.get("toDate"));
            String plazaId = (String) body.get("plazaId");
            String status = (String) body.get("status");
            String vrn = (String) body.get("vrn");
            String tagId = (String) body.get("tagId");
            String acqTxnId = (String) body.get("acqTxnId");

            int page = body.get("page") != null ? ((Number) body.get("page")).intValue() : 0;
            int size = body.get("size") != null ? ((Number) body.get("size")).intValue() : 50;

            if (fromDate == null) fromDate = LocalDateTime.of(2026, 8, 1, 0, 0, 0);
            if (toDate == null) toDate = LocalDateTime.of(2026, 9, 30, 23, 59, 59);

            Page<TollTransaction> pageResult = service.searchTransactions(
                    fromDate, toDate, plazaId, status, vrn, tagId, acqTxnId,
                    PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "txnDate"))
            );

            Map<String, Object> summary = service.calculateSummary(
                    fromDate, toDate, plazaId, status, vrn, tagId, acqTxnId
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
            log.error("Error executing Transaction Search - Normal search: {}", ex.getMessage(), ex);
            return ResponseEntity.internalServerError().body(Map.of("error", ex.getMessage()));
        }
    }

    @PostMapping("/export")
    @Auditable(module = "Transactional Reports", action = "EXPORT_TRANSACTION_SEARCH_NORMAL_EXCEL", actionLabel = "Exported Transaction Search - Normal Txn (Excel)", target = "Transaction Search - Normal Txn")
    public void exportExcel(@RequestBody Map<String, Object> body, HttpServletResponse response) {
        try {
            LocalDateTime fromDate = parseDateTime(body.get("fromDate"));
            LocalDateTime toDate = parseDateTime(body.get("toDate"));
            String plazaId = (String) body.get("plazaId");
            String status = (String) body.get("status");
            String vrn = (String) body.get("vrn");
            String tagId = (String) body.get("tagId");
            String acqTxnId = (String) body.get("acqTxnId");

            if (fromDate == null) fromDate = LocalDateTime.of(2026, 8, 1, 0, 0, 0);
            if (toDate == null) toDate = LocalDateTime.of(2026, 9, 30, 23, 59, 59);

            String fileName = "Transaction_Search_Normal_" + System.currentTimeMillis() + ".xlsx";
            response.setContentType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
            response.setHeader("Content-Disposition", "attachment; filename=\"" + fileName + "\"");

            service.streamExcelExport(fromDate, toDate, plazaId, status, vrn, tagId, acqTxnId, response.getOutputStream());
            response.flushBuffer();
        } catch (Exception ex) {
            log.error("Error exporting Transaction Search - Normal Excel: {}", ex.getMessage(), ex);
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
        }
    }

    @PostMapping("/export/csv")
    @Auditable(module = "Transactional Reports", action = "EXPORT_TRANSACTION_SEARCH_NORMAL_CSV", actionLabel = "Exported Transaction Search - Normal Txn (CSV)", target = "Transaction Search - Normal Txn")
    public void exportCsv(@RequestBody Map<String, Object> body, HttpServletResponse response) {
        try {
            LocalDateTime fromDate = parseDateTime(body.get("fromDate"));
            LocalDateTime toDate = parseDateTime(body.get("toDate"));
            String plazaId = (String) body.get("plazaId");
            String status = (String) body.get("status");
            String vrn = (String) body.get("vrn");
            String tagId = (String) body.get("tagId");
            String acqTxnId = (String) body.get("acqTxnId");

            if (fromDate == null) fromDate = LocalDateTime.of(2026, 8, 1, 0, 0, 0);
            if (toDate == null) toDate = LocalDateTime.of(2026, 9, 30, 23, 59, 59);

            String fileName = "Transaction_Search_Normal_" + System.currentTimeMillis() + ".csv";
            response.setContentType("text/csv; charset=UTF-8");
            response.setHeader("Content-Disposition", "attachment; filename=\"" + fileName + "\"");

            service.streamCsvExport(fromDate, toDate, plazaId, status, vrn, tagId, acqTxnId, response.getOutputStream());
            response.flushBuffer();
        } catch (Exception ex) {
            log.error("Error exporting Transaction Search - Normal CSV: {}", ex.getMessage(), ex);
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
