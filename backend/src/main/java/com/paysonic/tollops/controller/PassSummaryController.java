package com.paysonic.tollops.controller;

import com.paysonic.tollops.dto.PassSummaryResponseDTO;
import com.paysonic.tollops.service.PassSummaryService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/summary/pass-summary")
public class PassSummaryController {

    private final PassSummaryService service;

    public PassSummaryController(PassSummaryService service) {
        this.service = service;
    }

    @PostMapping("/search")
    public ResponseEntity<?> search(@RequestBody Map<String, Object> body) {
        try {
            String plazaId = (String) body.getOrDefault("plazaId", "ALL");
            LocalDate fromDate = parseLocalDate(body.get("fromDate"));
            LocalDate toDate = parseLocalDate(body.get("toDate"));
            if (fromDate == null) fromDate = LocalDate.of(2026, 9, 1);
            if (toDate == null) toDate = LocalDate.of(2026, 9, 30);
            return ResponseEntity.ok(service.getReport(plazaId, fromDate, toDate));
        } catch (Exception ex) {
            return ResponseEntity.internalServerError().body(Map.of("error", ex.getMessage()));
        }
    }

    @PostMapping("/export")
    public ResponseEntity<?> exportExcel(@RequestBody Map<String, Object> body) {
        try {
            String plazaId = (String) body.getOrDefault("plazaId", "ALL");
            LocalDate fromDate = parseLocalDate(body.get("fromDate"));
            LocalDate toDate = parseLocalDate(body.get("toDate"));
            if (fromDate == null) fromDate = LocalDate.of(2026, 9, 1);
            if (toDate == null) toDate = LocalDate.of(2026, 9, 30);

            byte[] data = service.exportExcel(plazaId, fromDate, toDate);
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION,
                            "attachment; filename=\"Pass_Summary_Report.xlsx\"")
                    .contentType(MediaType.parseMediaType(
                            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                    .body(data);
        } catch (Exception ex) {
            return ResponseEntity.internalServerError().body(Map.of("error", ex.getMessage()));
        }
    }

    @PostMapping("/export/csv")
    public ResponseEntity<?> exportCsv(@RequestBody Map<String, Object> body) {
        try {
            String plazaId = (String) body.getOrDefault("plazaId", "ALL");
            LocalDate fromDate = parseLocalDate(body.get("fromDate"));
            LocalDate toDate = parseLocalDate(body.get("toDate"));
            if (fromDate == null) fromDate = LocalDate.of(2026, 9, 1);
            if (toDate == null) toDate = LocalDate.of(2026, 9, 30);

            byte[] data = service.exportCsv(plazaId, fromDate, toDate);
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION,
                            "attachment; filename=\"Pass_Summary_Report.csv\"")
                    .contentType(MediaType.parseMediaType("text/csv; charset=UTF-8"))
                    .body(data);
        } catch (Exception ex) {
            return ResponseEntity.internalServerError().body(Map.of("error", ex.getMessage()));
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
                return LocalDate.parse(str, java.time.format.DateTimeFormatter.ISO_LOCAL_DATE);
            }
            if (str.contains("-")) {
                return LocalDate.parse(str, java.time.format.DateTimeFormatter.ofPattern("dd-MM-yyyy"));
            }
            return LocalDate.parse(str);
        } catch (Exception e) {
            return null;
        }
    }
}
