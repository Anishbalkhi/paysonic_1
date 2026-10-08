package com.paysonic.tollops.service;

import com.paysonic.tollops.entity.ViolationTransaction;
import com.paysonic.tollops.repository.ViolationTransactionRepository;
import jakarta.persistence.criteria.Predicate;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.streaming.SXSSFWorkbook;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.OutputStream;
import java.io.PrintWriter;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class ViolationBulkActionService {

    private static final Logger log = LoggerFactory.getLogger(ViolationBulkActionService.class);
    private final ViolationTransactionRepository repository;

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("dd-MM-yyyy HH:mm:ss");

    public ViolationBulkActionService(ViolationTransactionRepository repository) {
        this.repository = repository;
    }

    public Page<ViolationTransaction> searchViolations(
            LocalDateTime fromDate,
            LocalDateTime toDate,
            String plazaId,
            String apiStatus,
            String vrn,
            String tagId,
            String acqTxnId,
            Pageable pageable) {

        Specification<ViolationTransaction> spec = buildSpecification(fromDate, toDate, plazaId, apiStatus, vrn, tagId, acqTxnId);
        return repository.findAll(spec, pageable);
    }

    public Map<String, Object> calculateSummary(
            LocalDateTime fromDate,
            LocalDateTime toDate,
            String plazaId,
            String apiStatus,
            String vrn,
            String tagId,
            String acqTxnId) {

        Specification<ViolationTransaction> spec = buildSpecification(fromDate, toDate, plazaId, apiStatus, vrn, tagId, acqTxnId);
        List<ViolationTransaction> records = repository.findAll(spec);

        long totalCount = records.size();
        BigDecimal totalAmount = BigDecimal.ZERO;
        long acceptedCount = 0;
        long declinedCount = 0;

        for (ViolationTransaction v : records) {
            BigDecimal amt = v.getTxnAmount() != null ? v.getTxnAmount() : BigDecimal.ZERO;
            totalAmount = totalAmount.add(amt);

            String st = v.getViolationApiStatus() != null ? v.getViolationApiStatus().trim().toUpperCase() : "";
            if ("ACCEPTED".equals(st)) {
                acceptedCount++;
            } else if ("DECLINED".equals(st)) {
                declinedCount++;
            }
        }

        Map<String, Object> summary = new HashMap<>();
        summary.put("totalCount", totalCount);
        summary.put("totalAmount", totalAmount);
        summary.put("acceptedCount", acceptedCount);
        summary.put("declinedCount", declinedCount);
        return summary;
    }

    @Transactional
    public Map<String, Object> applyBulkAction(List<Long> ids, String action, String remarks) {
        if (ids == null || ids.isEmpty()) {
            return Map.of("success", false, "message", "No violation transactions selected for bulk action.");
        }

        List<ViolationTransaction> targets = repository.findAllById(ids);
        String upperAction = action != null ? action.trim().toUpperCase() : "APPROVED";

        for (ViolationTransaction v : targets) {
            v.setActionStatus(upperAction);
            if (remarks != null && !remarks.isBlank()) {
                v.setAuditRemark(remarks.trim());
            }
            if ("APPROVE".equalsIgnoreCase(upperAction) || "APPROVED".equalsIgnoreCase(upperAction)) {
                v.setAuditDesc("Approved via Bulk Action");
                v.setViolationApiStatus("ACCEPTED");
            } else if ("DECLINE".equalsIgnoreCase(upperAction) || "REJECT".equalsIgnoreCase(upperAction) || "REJECTED".equalsIgnoreCase(upperAction)) {
                v.setAuditDesc("Rejected via Bulk Action");
                v.setViolationApiStatus("DECLINED");
            }
        }

        repository.saveAll(targets);
        log.info("Bulk action '{}' successfully applied to {} violation records.", upperAction, targets.size());

        Map<String, Object> res = new HashMap<>();
        res.put("success", true);
        res.put("updatedCount", targets.size());
        res.put("action", upperAction);
        res.put("message", "Bulk action applied successfully to " + targets.size() + " record(s).");
        return res;
    }

    public void streamExcelExport(
            LocalDateTime fromDate,
            LocalDateTime toDate,
            String plazaId,
            String apiStatus,
            String vrn,
            String tagId,
            String acqTxnId,
            OutputStream outputStream) throws Exception {

        Specification<ViolationTransaction> spec = buildSpecification(fromDate, toDate, plazaId, apiStatus, vrn, tagId, acqTxnId);
        List<ViolationTransaction> records = repository.findAll(spec);

        try (SXSSFWorkbook workbook = new SXSSFWorkbook(100)) {
            Sheet sheet = workbook.createSheet("Violation Bulk Action");
            DataFormat dataFormat = workbook.createDataFormat();

            // Title Style
            CellStyle titleStyle = workbook.createCellStyle();
            Font titleFont = workbook.createFont();
            titleFont.setFontName("Calibri");
            titleFont.setFontHeightInPoints((short) 16);
            titleFont.setBold(true);
            titleFont.setColor(IndexedColors.DARK_BLUE.getIndex());
            titleStyle.setFont(titleFont);
            titleStyle.setAlignment(HorizontalAlignment.CENTER);
            titleStyle.setVerticalAlignment(VerticalAlignment.CENTER);

            // Subtitle Style
            CellStyle subTitleStyle = workbook.createCellStyle();
            Font subFont = workbook.createFont();
            subFont.setFontName("Calibri");
            subFont.setFontHeightInPoints((short) 10);
            subFont.setColor(IndexedColors.GREY_50_PERCENT.getIndex());
            subTitleStyle.setFont(subFont);
            subTitleStyle.setAlignment(HorizontalAlignment.CENTER);
            subTitleStyle.setVerticalAlignment(VerticalAlignment.CENTER);

            // Green accent separator line
            CellStyle greenBarStyle = workbook.createCellStyle();
            greenBarStyle.setFillForegroundColor(IndexedColors.GREEN.getIndex());
            greenBarStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);

            // Header Style
            CellStyle headerStyle = workbook.createCellStyle();
            Font headerFont = workbook.createFont();
            headerFont.setFontName("Calibri");
            headerFont.setFontHeightInPoints((short) 11);
            headerFont.setBold(true);
            headerFont.setColor(IndexedColors.WHITE.getIndex());
            headerStyle.setFont(headerFont);
            headerStyle.setFillForegroundColor(IndexedColors.ROYAL_BLUE.getIndex());
            headerStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            headerStyle.setAlignment(HorizontalAlignment.CENTER);
            headerStyle.setVerticalAlignment(VerticalAlignment.CENTER);
            headerStyle.setBorderBottom(BorderStyle.THIN);
            headerStyle.setBorderTop(BorderStyle.THIN);
            headerStyle.setBorderLeft(BorderStyle.THIN);
            headerStyle.setBorderRight(BorderStyle.THIN);

            // Data Cell Styles
            CellStyle textStyle = workbook.createCellStyle();
            textStyle.setBorderBottom(BorderStyle.THIN);
            textStyle.setBorderTop(BorderStyle.THIN);
            textStyle.setBorderLeft(BorderStyle.THIN);
            textStyle.setBorderRight(BorderStyle.THIN);

            CellStyle centerStyle = workbook.createCellStyle();
            centerStyle.setAlignment(HorizontalAlignment.CENTER);
            centerStyle.setVerticalAlignment(VerticalAlignment.CENTER);
            centerStyle.setBorderBottom(BorderStyle.THIN);
            centerStyle.setBorderTop(BorderStyle.THIN);
            centerStyle.setBorderLeft(BorderStyle.THIN);
            centerStyle.setBorderRight(BorderStyle.THIN);

            CellStyle numberStyle = workbook.createCellStyle();
            numberStyle.setDataFormat(dataFormat.getFormat("#,##0.00"));
            numberStyle.setAlignment(HorizontalAlignment.RIGHT);
            numberStyle.setVerticalAlignment(VerticalAlignment.CENTER);
            numberStyle.setBorderBottom(BorderStyle.THIN);
            numberStyle.setBorderTop(BorderStyle.THIN);
            numberStyle.setBorderLeft(BorderStyle.THIN);
            numberStyle.setBorderRight(BorderStyle.THIN);

            // Status Styles
            CellStyle acceptedStyle = workbook.createCellStyle();
            acceptedStyle.setFillForegroundColor(IndexedColors.LIGHT_GREEN.getIndex());
            acceptedStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            acceptedStyle.setAlignment(HorizontalAlignment.CENTER);
            acceptedStyle.setVerticalAlignment(VerticalAlignment.CENTER);
            acceptedStyle.setBorderBottom(BorderStyle.THIN);
            acceptedStyle.setBorderTop(BorderStyle.THIN);
            acceptedStyle.setBorderLeft(BorderStyle.THIN);
            acceptedStyle.setBorderRight(BorderStyle.THIN);
            Font accFont = workbook.createFont();
            accFont.setBold(true);
            accFont.setColor(IndexedColors.DARK_GREEN.getIndex());
            acceptedStyle.setFont(accFont);

            CellStyle declinedStyle = workbook.createCellStyle();
            declinedStyle.setFillForegroundColor(IndexedColors.ROSE.getIndex());
            declinedStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            declinedStyle.setAlignment(HorizontalAlignment.CENTER);
            declinedStyle.setVerticalAlignment(VerticalAlignment.CENTER);
            declinedStyle.setBorderBottom(BorderStyle.THIN);
            declinedStyle.setBorderTop(BorderStyle.THIN);
            declinedStyle.setBorderLeft(BorderStyle.THIN);
            declinedStyle.setBorderRight(BorderStyle.THIN);
            Font decFont = workbook.createFont();
            decFont.setBold(true);
            decFont.setColor(IndexedColors.DARK_RED.getIndex());
            declinedStyle.setFont(decFont);

            String[] headers = {
                "Plaza ID", "Plaza Name", "VRN", "Tag ID", "Acq Txn ID",
                "Toll Txn ID", "Txn Amount", "Txn Date Time", "MVC", "AVC",
                "Audit VC", "Audit remark", "Audit Desc", "Violation Img",
                "NETC Txn Type", "Violation API Status"
            };

            // Row 0: Title Banner
            Row titleRow = sheet.createRow(0);
            titleRow.setHeightInPoints(32);
            Cell titleCell = titleRow.createCell(0);
            titleCell.setCellValue("VIOLATION BULK ACTION");
            titleCell.setCellStyle(titleStyle);
            sheet.addMergedRegion(new CellRangeAddress(0, 0, 0, headers.length - 1));

            // Row 1: Subtitle
            Row subTitleRow = sheet.createRow(1);
            subTitleRow.setHeightInPoints(20);
            Cell subTitleCell = subTitleRow.createCell(0);
            subTitleCell.setCellValue("From Date: " + fromDate.format(DATE_FMT) + " | To Date: " + toDate.format(DATE_FMT) + " | Report Fetch Time: " + LocalDateTime.now().format(DATE_FMT));
            subTitleCell.setCellStyle(subTitleStyle);
            sheet.addMergedRegion(new CellRangeAddress(1, 1, 0, headers.length - 1));

            // Row 2: Green accent bar
            Row greenBarRow = sheet.createRow(2);
            greenBarRow.setHeightInPoints(4);
            for (int i = 0; i < headers.length; i++) {
                Cell barCell = greenBarRow.createCell(i);
                barCell.setCellStyle(greenBarStyle);
            }

            // Row 3: Headers
            Row headerRow = sheet.createRow(3);
            headerRow.setHeightInPoints(26);
            for (int i = 0; i < headers.length; i++) {
                Cell cell = headerRow.createCell(i);
                cell.setCellValue(headers[i]);
                cell.setCellStyle(headerStyle);
            }

            // Data rows
            int rowIdx = 4;
            long totalCount = 0;
            BigDecimal totalAmount = BigDecimal.ZERO;
            long acceptedCount = 0;
            long declinedCount = 0;

            for (ViolationTransaction v : records) {
                totalCount++;
                BigDecimal amt = v.getTxnAmount() != null ? v.getTxnAmount() : BigDecimal.ZERO;
                totalAmount = totalAmount.add(amt);

                String apiSt = v.getViolationApiStatus() != null ? v.getViolationApiStatus().trim().toUpperCase() : "ACCEPTED";
                if ("ACCEPTED".equals(apiSt)) acceptedCount++;
                else if ("DECLINED".equals(apiSt)) declinedCount++;

                Row row = sheet.createRow(rowIdx);

                // 0. Plaza ID
                Cell c0 = row.createCell(0); c0.setCellValue(blankIfNull(v.getPlazaId())); c0.setCellStyle(centerStyle);
                // 1. Plaza Name
                Cell c1 = row.createCell(1); c1.setCellValue(blankIfNull(v.getPlazaName())); c1.setCellStyle(textStyle);
                // 2. VRN
                Cell c2 = row.createCell(2); c2.setCellValue(blankIfNull(v.getVrn())); c2.setCellStyle(centerStyle);
                // 3. Tag ID
                Cell c3 = row.createCell(3); c3.setCellValue(blankIfNull(v.getTagId())); c3.setCellStyle(textStyle);
                // 4. Acq Txn ID
                Cell c4 = row.createCell(4); c4.setCellValue(blankIfNull(v.getAcqTxnId())); c4.setCellStyle(centerStyle);
                // 5. Toll Txn ID
                Cell c5 = row.createCell(5); c5.setCellValue(blankIfNull(v.getTollTxnId())); c5.setCellStyle(centerStyle);
                // 6. Txn Amount
                Cell c6 = row.createCell(6); c6.setCellValue(amt.doubleValue()); c6.setCellStyle(numberStyle);
                // 7. Txn Date Time
                Cell c7 = row.createCell(7); c7.setCellValue(formatDate(v.getTxnDateTime())); c7.setCellStyle(centerStyle);
                // 8. MVC
                Cell c8 = row.createCell(8); c8.setCellValue(blankIfNull(v.getMvc())); c8.setCellStyle(centerStyle);
                // 9. AVC
                Cell c9 = row.createCell(9); c9.setCellValue(blankIfNull(v.getAvc())); c9.setCellStyle(centerStyle);
                // 10. Audit VC
                Cell c10 = row.createCell(10); c10.setCellValue(blankIfNull(v.getAuditVc())); c10.setCellStyle(centerStyle);
                // 11. Audit remark
                Cell c11 = row.createCell(11); c11.setCellValue(blankIfNull(v.getAuditRemark())); c11.setCellStyle(centerStyle);
                // 12. Audit Desc
                Cell c12 = row.createCell(12); c12.setCellValue(blankIfNull(v.getAuditDesc())); c12.setCellStyle(textStyle);
                // 13. Violation Img
                Cell c13 = row.createCell(13); c13.setCellValue(blankIfNull(v.getViolationImg())); c13.setCellStyle(centerStyle);
                // 14. NETC Txn Type
                Cell c14 = row.createCell(14); c14.setCellValue(blankIfNull(v.getNetcTxnType())); c14.setCellStyle(centerStyle);
                // 15. Violation API Status
                Cell c15 = row.createCell(15); c15.setCellValue(apiSt);
                if ("ACCEPTED".equals(apiSt)) c15.setCellStyle(acceptedStyle);
                else if ("DECLINED".equals(apiSt)) c15.setCellStyle(declinedStyle);
                else c15.setCellStyle(centerStyle);

                rowIdx++;
            }

            // Summary Section
            rowIdx++;
            Row summaryRow = sheet.createRow(rowIdx);
            summaryRow.setHeightInPoints(26);

            CellStyle greenKpiStyle = workbook.createCellStyle();
            greenKpiStyle.setFillForegroundColor(IndexedColors.GREEN.getIndex());
            greenKpiStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            greenKpiStyle.setAlignment(HorizontalAlignment.CENTER);
            greenKpiStyle.setVerticalAlignment(VerticalAlignment.CENTER);
            Font greenKpiFont = workbook.createFont();
            greenKpiFont.setBold(true);
            greenKpiFont.setColor(IndexedColors.WHITE.getIndex());
            greenKpiStyle.setFont(greenKpiFont);

            CellStyle blueKpiStyle = workbook.createCellStyle();
            blueKpiStyle.setFillForegroundColor(IndexedColors.ROYAL_BLUE.getIndex());
            blueKpiStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            blueKpiStyle.setAlignment(HorizontalAlignment.CENTER);
            blueKpiStyle.setVerticalAlignment(VerticalAlignment.CENTER);
            Font blueKpiFont = workbook.createFont();
            blueKpiFont.setBold(true);
            blueKpiFont.setColor(IndexedColors.WHITE.getIndex());
            blueKpiStyle.setFont(blueKpiFont);

            Cell k1 = summaryRow.createCell(0);
            k1.setCellValue("Total Violations: " + totalCount);
            k1.setCellStyle(greenKpiStyle);
            sheet.addMergedRegion(new CellRangeAddress(rowIdx, rowIdx, 0, 3));

            Cell k2 = summaryRow.createCell(4);
            k2.setCellValue(String.format("Total Txn Amount: %.2f", totalAmount.doubleValue()));
            k2.setCellStyle(blueKpiStyle);
            sheet.addMergedRegion(new CellRangeAddress(rowIdx, rowIdx, 4, 7));

            Cell k3 = summaryRow.createCell(8);
            k3.setCellValue("Accepted: " + acceptedCount);
            k3.setCellStyle(greenKpiStyle);
            sheet.addMergedRegion(new CellRangeAddress(rowIdx, rowIdx, 8, 11));

            Cell k4 = summaryRow.createCell(12);
            k4.setCellValue("Declined: " + declinedCount);
            k4.setCellStyle(blueKpiStyle);
            sheet.addMergedRegion(new CellRangeAddress(rowIdx, rowIdx, 12, headers.length - 1));

            // Set column widths
            sheet.setColumnWidth(0, 3200);  // Plaza ID
            sheet.setColumnWidth(1, 5800);  // Plaza Name
            sheet.setColumnWidth(2, 4200);  // VRN
            sheet.setColumnWidth(3, 7500);  // Tag ID
            sheet.setColumnWidth(4, 6500);  // Acq Txn ID
            sheet.setColumnWidth(5, 3800);  // Toll Txn ID
            sheet.setColumnWidth(6, 3500);  // Txn Amount
            sheet.setColumnWidth(7, 5500);  // Txn Date Time
            sheet.setColumnWidth(8, 2500);  // MVC
            sheet.setColumnWidth(9, 2500);  // AVC
            sheet.setColumnWidth(10, 2800); // Audit VC
            sheet.setColumnWidth(11, 3500); // Audit remark
            sheet.setColumnWidth(12, 9000); // Audit Desc
            sheet.setColumnWidth(13, 3500); // Violation Img
            sheet.setColumnWidth(14, 3800); // NETC Txn Type
            sheet.setColumnWidth(15, 4500); // Violation API Status

            workbook.write(outputStream);
        }
    }

    public void streamCsvExport(
            LocalDateTime fromDate,
            LocalDateTime toDate,
            String plazaId,
            String apiStatus,
            String vrn,
            String tagId,
            String acqTxnId,
            OutputStream outputStream) throws Exception {

        Specification<ViolationTransaction> spec = buildSpecification(fromDate, toDate, plazaId, apiStatus, vrn, tagId, acqTxnId);
        List<ViolationTransaction> records = repository.findAll(spec);

        outputStream.write(new byte[]{(byte) 0xEF, (byte) 0xBB, (byte) 0xBF});

        try (PrintWriter writer = new PrintWriter(outputStream, true, StandardCharsets.UTF_8)) {
            writer.println("\"VIOLATION BULK ACTION\"");
            writer.println("\"From Date: " + fromDate.format(DATE_FMT) + " | To Date: " + toDate.format(DATE_FMT) + " | Report Fetch Time: " + LocalDateTime.now().format(DATE_FMT) + "\"");
            writer.println();

            String[] headers = {
                "Plaza ID", "Plaza Name", "VRN", "Tag ID", "Acq Txn ID",
                "Toll Txn ID", "Txn Amount", "Txn Date Time", "MVC", "AVC",
                "Audit VC", "Audit remark", "Audit Desc", "Violation Img",
                "NETC Txn Type", "Violation API Status"
            };
            writer.println(String.join(",", escapeHeaders(headers)));

            long totalCount = 0;
            BigDecimal totalAmount = BigDecimal.ZERO;
            long acceptedCount = 0;
            long declinedCount = 0;

            for (ViolationTransaction v : records) {
                totalCount++;
                BigDecimal amt = v.getTxnAmount() != null ? v.getTxnAmount() : BigDecimal.ZERO;
                totalAmount = totalAmount.add(amt);

                String apiSt = v.getViolationApiStatus() != null ? v.getViolationApiStatus().trim().toUpperCase() : "ACCEPTED";
                if ("ACCEPTED".equals(apiSt)) acceptedCount++;
                else if ("DECLINED".equals(apiSt)) declinedCount++;

                String[] row = {
                    csvEscape(blankIfNull(v.getPlazaId())),
                    csvEscape(blankIfNull(v.getPlazaName())),
                    csvEscape(blankIfNull(v.getVrn())),
                    csvEscape(blankIfNull(v.getTagId())),
                    csvEscape(blankIfNull(v.getAcqTxnId())),
                    csvEscape(blankIfNull(v.getTollTxnId())),
                    amt.toString(),
                    csvEscape(formatDate(v.getTxnDateTime())),
                    csvEscape(blankIfNull(v.getMvc())),
                    csvEscape(blankIfNull(v.getAvc())),
                    csvEscape(blankIfNull(v.getAuditVc())),
                    csvEscape(blankIfNull(v.getAuditRemark())),
                    csvEscape(blankIfNull(v.getAuditDesc())),
                    csvEscape(blankIfNull(v.getViolationImg())),
                    csvEscape(blankIfNull(v.getNetcTxnType())),
                    csvEscape(apiSt)
                };
                writer.println(String.join(",", row));
            }

            writer.println();
            writer.println("\"--- SUMMARY KPIS ---\"");
            writer.println("\"Total Violations\"," + totalCount);
            writer.println("\"Total Txn Amount\"," + String.format("%.2f", totalAmount.doubleValue()));
            writer.println("\"Accepted API Count\"," + acceptedCount);
            writer.println("\"Declined API Count\"," + declinedCount);
            writer.println("\"DataSource\",\"Live Railway MySQL DB: ONLINE\"");
            writer.flush();
        }
    }

    private Specification<ViolationTransaction> buildSpecification(
            LocalDateTime fromDate,
            LocalDateTime toDate,
            String plazaId,
            String apiStatus,
            String vrn,
            String tagId,
            String acqTxnId) {

        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            if (fromDate != null && toDate != null) {
                predicates.add(cb.between(root.get("txnDateTime"), fromDate, toDate));
            } else if (fromDate != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("txnDateTime"), fromDate));
            } else if (toDate != null) {
                predicates.add(cb.lessThanOrEqualTo(root.get("txnDateTime"), toDate));
            }

            if (plazaId != null && !plazaId.isBlank() && !"ALL".equalsIgnoreCase(plazaId)) {
                predicates.add(cb.equal(root.get("plazaId"), plazaId.trim()));
            }

            if (apiStatus != null && !apiStatus.isBlank() && !"ALL".equalsIgnoreCase(apiStatus)) {
                predicates.add(cb.equal(cb.upper(root.get("violationApiStatus")), apiStatus.trim().toUpperCase()));
            }

            boolean vrnPresent = vrn != null && !vrn.isBlank();
            boolean tagPresent = tagId != null && !tagId.isBlank();
            boolean acqPresent = acqTxnId != null && !acqTxnId.isBlank();

            if (vrnPresent && tagPresent && acqPresent && vrn.trim().equalsIgnoreCase(tagId.trim())) {
                String term = vrn.trim().toLowerCase();
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("vrn")), "%" + term + "%"),
                        cb.like(cb.lower(root.get("tagId")), "%" + term + "%"),
                        cb.like(cb.lower(root.get("acqTxnId")), "%" + term + "%"),
                        cb.like(cb.lower(root.get("tollTxnId")), "%" + term + "%")
                ));
            } else {
                if (vrnPresent) {
                    predicates.add(cb.like(cb.lower(root.get("vrn")), "%" + vrn.trim().toLowerCase() + "%"));
                }
                if (tagPresent) {
                    predicates.add(cb.like(cb.lower(root.get("tagId")), "%" + tagId.trim().toLowerCase() + "%"));
                }
                if (acqPresent) {
                    predicates.add(cb.like(cb.lower(root.get("acqTxnId")), "%" + acqTxnId.trim().toLowerCase() + "%"));
                }
            }

            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }

    private String formatDate(LocalDateTime dt) {
        return dt != null ? dt.format(DATE_FMT) : "";
    }

    private String blankIfNull(String str) {
        return str != null ? str : "";
    }

    private String[] escapeHeaders(String[] headers) {
        String[] escaped = new String[headers.length];
        for (int i = 0; i < headers.length; i++) {
            escaped[i] = "\"" + headers[i].replace("\"", "\"\"") + "\"";
        }
        return escaped;
    }

    private String csvEscape(String val) {
        if (val == null) return "\"\"";
        return "\"" + val.replace("\"", "\"\"") + "\"";
    }
}
