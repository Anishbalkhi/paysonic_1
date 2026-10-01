package com.paysonic.tollops.controller;

import com.paysonic.tollops.aspect.Auditable;
import com.paysonic.tollops.dto.NhaiTrafficReportDTO;
import com.paysonic.tollops.service.NhaiTrafficReportService;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Map;

@RestController
@RequestMapping("/api/summary/nhai-traffic")
@CrossOrigin(origins = "*")
public class NhaiTrafficReportController {

    private static final Logger log = LoggerFactory.getLogger(NhaiTrafficReportController.class);
    private final NhaiTrafficReportService service;

    public NhaiTrafficReportController(NhaiTrafficReportService service) {
        this.service = service;
    }

    @PostMapping("/search")
    public ResponseEntity<?> search(@RequestBody Map<String, Object> body) {
        try {
            LocalDate fromDate = parseLocalDate(body.get("fromDate"));
            LocalDate toDate = parseLocalDate(body.get("toDate"));
            String plazaCode = (String) body.get("plazaCode");

            if (fromDate == null) fromDate = LocalDate.of(2026, 9, 1);
            if (toDate == null) toDate = LocalDate.of(2026, 9, 30);

            NhaiTrafficReportDTO report = service.generateReport(fromDate, toDate, plazaCode);
            return ResponseEntity.ok(report);
        } catch (Exception ex) {
            log.error("Error generating NHAI Traffic Report: {}", ex.getMessage(), ex);
            return ResponseEntity.internalServerError().body(Map.of("error", ex.getMessage()));
        }
    }

    @PostMapping("/export")
    @Auditable(module = "Summary Report", action = "EXPORT_NHAI_TRAFFIC_EXCEL", actionLabel = "Exported NHAI Traffic Report (Excel)", target = "NHAI Traffic Report")
    public void exportExcel(@RequestBody Map<String, Object> body, HttpServletResponse response) {
        try {
            LocalDate fromDate = parseLocalDate(body.get("fromDate"));
            LocalDate toDate = parseLocalDate(body.get("toDate"));
            String plazaCode = (String) body.get("plazaCode");

            if (fromDate == null) fromDate = LocalDate.of(2026, 9, 1);
            if (toDate == null) toDate = LocalDate.of(2026, 9, 30);

            String fileName = "NHAI_Traffic_Report_" + System.currentTimeMillis() + ".xlsx";
            response.setContentType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
            response.setHeader("Content-Disposition", "attachment; filename=\"" + fileName + "\"");

            service.streamExcelExport(fromDate, toDate, plazaCode, response.getOutputStream());
            response.flushBuffer();
        } catch (Exception ex) {
            log.error("Error exporting NHAI Traffic Report Excel: {}", ex.getMessage(), ex);
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
        }
    }

    @PostMapping("/export/csv")
    @Auditable(module = "Summary Report", action = "EXPORT_NHAI_TRAFFIC_CSV", actionLabel = "Exported NHAI Traffic Report (CSV)", target = "NHAI Traffic Report")
    public void exportCsv(@RequestBody Map<String, Object> body, HttpServletResponse response) {
        try {
            LocalDate fromDate = parseLocalDate(body.get("fromDate"));
            LocalDate toDate = parseLocalDate(body.get("toDate"));
            String plazaCode = (String) body.get("plazaCode");

            if (fromDate == null) fromDate = LocalDate.of(2026, 9, 1);
            if (toDate == null) toDate = LocalDate.of(2026, 9, 30);

            String fileName = "NHAI_Traffic_Report_" + System.currentTimeMillis() + ".csv";
            response.setContentType("text/csv; charset=UTF-8");
            response.setHeader("Content-Disposition", "attachment; filename=\"" + fileName + "\"");

            service.streamCsvExport(fromDate, toDate, plazaCode, response.getOutputStream());
            response.flushBuffer();
        } catch (Exception ex) {
            log.error("Error exporting NHAI Traffic Report CSV: {}", ex.getMessage(), ex);
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
