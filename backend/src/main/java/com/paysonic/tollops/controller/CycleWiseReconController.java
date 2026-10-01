package com.paysonic.tollops.controller;

import com.paysonic.tollops.aspect.Auditable;
import com.paysonic.tollops.dto.CycleWiseReconDTO;
import com.paysonic.tollops.service.CycleWiseReconService;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/reports/cycle-wise-recon")
@CrossOrigin(origins = "*")
public class CycleWiseReconController {

    private static final Logger log = LoggerFactory.getLogger(CycleWiseReconController.class);
    private final CycleWiseReconService cycleWiseReconService;

    public CycleWiseReconController(CycleWiseReconService cycleWiseReconService) {
        this.cycleWiseReconService = cycleWiseReconService;
    }

    @GetMapping("/search")
    public ResponseEntity<?> search(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime fromDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime toDate,
            @RequestParam(required = false) String plazaId,
            @RequestParam(required = false) String cycle) {

        try {
            LocalDateTime effectiveFrom = fromDate != null ? fromDate : LocalDateTime.now().minusDays(60).withHour(0).withMinute(0).withSecond(1);
            LocalDateTime effectiveTo = toDate != null ? toDate : LocalDateTime.now().withHour(23).withMinute(59).withSecond(59);

            validateDateRange(effectiveFrom, effectiveTo);

            List<CycleWiseReconDTO> results = cycleWiseReconService.searchCycleWiseRecon(effectiveFrom, effectiveTo, plazaId, cycle);
            return ResponseEntity.ok(results);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        } catch (Exception ex) {
            log.error("Error executing Cycle Wise Recon search: {}", ex.getMessage(), ex);
            return ResponseEntity.internalServerError().body(Map.of("error", "Error searching Cycle Wise Recon: " + ex.getMessage()));
        }
    }

    @GetMapping("/export")
    @Auditable(module = "Recon Management", action = "EXPORT_CYCLE_WISE_RECON", actionLabel = "Exported Cycle Wise Recon Report (Excel)", target = "Cycle Wise Recon")
    public void exportExcel(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime fromDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime toDate,
            @RequestParam(required = false) String plazaId,
            @RequestParam(required = false) String cycle,
            HttpServletResponse response) {

        try {
            LocalDateTime effectiveFrom = fromDate != null ? fromDate : LocalDateTime.now().minusDays(60).withHour(0).withMinute(0).withSecond(1);
            LocalDateTime effectiveTo = toDate != null ? toDate : LocalDateTime.now().withHour(23).withMinute(59).withSecond(59);

            validateDateRange(effectiveFrom, effectiveTo);

            String fileName = "Cycle_Wise_Report_" + System.currentTimeMillis() + ".xlsx";
            response.setContentType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
            response.setHeader("Content-Disposition", "attachment; filename=\"" + fileName + "\"");

            cycleWiseReconService.streamExcelExport(effectiveFrom, effectiveTo, plazaId, cycle, response.getOutputStream());
            response.flushBuffer();
        } catch (IllegalArgumentException ex) {
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
        } catch (Exception ex) {
            log.error("Error exporting Cycle Wise Recon Excel: {}", ex.getMessage(), ex);
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
