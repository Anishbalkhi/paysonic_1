package com.paysonic.tollops.controller;

import com.paysonic.tollops.aspect.Auditable;
import com.paysonic.tollops.dto.TollFareItemDto;
import com.paysonic.tollops.service.TollFareReportService;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/reports/toll-fare")
@CrossOrigin(origins = "*")
public class TollFareReportController {

    private static final Logger log = LoggerFactory.getLogger(TollFareReportController.class);
    private final TollFareReportService tollFareReportService;

    public TollFareReportController(TollFareReportService tollFareReportService) {
        this.tollFareReportService = tollFareReportService;
    }

    @GetMapping("/search")
    public ResponseEntity<?> search(
            @RequestParam(required = false, defaultValue = "600601") String plazaId,
            @RequestParam(required = false) String vehicleClass) {
        try {
            List<TollFareItemDto> fares = tollFareReportService.getFares(plazaId, vehicleClass);
            return ResponseEntity.ok(fares);
        } catch (Exception ex) {
            log.error("Error searching toll fares: {}", ex.getMessage(), ex);
            return ResponseEntity.internalServerError().body(Map.of("error", "Error searching toll fares: " + ex.getMessage()));
        }
    }

    @GetMapping({"/export", "/excel"})
    @Auditable(module = "Transactional Reports", action = "EXPORT_TOLL_FARE_REPORT_EXCEL", actionLabel = "Exported Toll Fare Report (Excel)", target = "Toll Fare Report")
    public void exportExcel(
            @RequestParam(required = false, defaultValue = "600601") String plazaId,
            @RequestParam(required = false) String vehicleClass,
            HttpServletResponse response) {
        try {
            String fileName = "Toll_Fare_Report_" + System.currentTimeMillis() + ".xlsx";
            response.setContentType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
            response.setHeader("Content-Disposition", "attachment; filename=\"" + fileName + "\"");

            tollFareReportService.streamExcelExport(plazaId, vehicleClass, response.getOutputStream());
            response.flushBuffer();
        } catch (Exception ex) {
            log.error("Error exporting Toll Fare Excel: {}", ex.getMessage(), ex);
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
        }
    }

    @GetMapping({"/export/csv", "/csv"})
    @Auditable(module = "Transactional Reports", action = "EXPORT_TOLL_FARE_REPORT_CSV", actionLabel = "Exported Toll Fare Report (CSV)", target = "Toll Fare Report")
    public void exportCsv(
            @RequestParam(required = false, defaultValue = "600601") String plazaId,
            @RequestParam(required = false) String vehicleClass,
            HttpServletResponse response) {
        try {
            String fileName = "Toll_Fare_Report_" + System.currentTimeMillis() + ".csv";
            response.setContentType("text/csv; charset=UTF-8");
            response.setHeader("Content-Disposition", "attachment; filename=\"" + fileName + "\"");

            tollFareReportService.streamCsvExport(plazaId, vehicleClass, response.getOutputStream());
            response.flushBuffer();
        } catch (Exception ex) {
            log.error("Error exporting Toll Fare CSV: {}", ex.getMessage(), ex);
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
        }
    }
}
