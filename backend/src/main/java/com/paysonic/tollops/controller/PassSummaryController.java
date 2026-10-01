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
    public ResponseEntity<List<PassSummaryResponseDTO>> search(@RequestBody Map<String, String> body) {
        String plazaId = body.getOrDefault("plazaId", "ALL");
        LocalDate fromDate = LocalDate.parse(body.get("fromDate"));
        LocalDate toDate = LocalDate.parse(body.get("toDate"));
        return ResponseEntity.ok(service.getReport(plazaId, fromDate, toDate));
    }

    @PostMapping("/export")
    public ResponseEntity<byte[]> exportExcel(@RequestBody Map<String, String> body) throws Exception {
        String plazaId = body.getOrDefault("plazaId", "ALL");
        LocalDate fromDate = LocalDate.parse(body.get("fromDate"));
        LocalDate toDate = LocalDate.parse(body.get("toDate"));
        byte[] data = service.exportExcel(plazaId, fromDate, toDate);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"Pass_Summary_Report.xlsx\"")
                .contentType(MediaType.parseMediaType(
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .body(data);
    }

    @PostMapping("/export/csv")
    public ResponseEntity<byte[]> exportCsv(@RequestBody Map<String, String> body) throws Exception {
        String plazaId = body.getOrDefault("plazaId", "ALL");
        LocalDate fromDate = LocalDate.parse(body.get("fromDate"));
        LocalDate toDate = LocalDate.parse(body.get("toDate"));
        byte[] data = service.exportCsv(plazaId, fromDate, toDate);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"Pass_Summary_Report.csv\"")
                .contentType(MediaType.parseMediaType("text/csv; charset=UTF-8"))
                .body(data);
    }
}
