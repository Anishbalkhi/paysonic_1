package com.paysonic.tollops.service;

import com.paysonic.tollops.entity.ViolationSettlementRecord;
import com.paysonic.tollops.repository.ViolationSettlementRepository;
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

import java.io.OutputStream;
import java.io.PrintWriter;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class ViolationSettlementService {

    private static final Logger log = LoggerFactory.getLogger(ViolationSettlementService.class);
    private final ViolationSettlementRepository repository;

    private static final DateTimeFormatter DATE_TIME_FMT = DateTimeFormatter.ofPattern("dd-MM-yyyy HH:mm:ss");
    private static final DateTimeFormatter DATE_ONLY_FMT = DateTimeFormatter.ofPattern("dd-MM-yyyy");

    public ViolationSettlementService(ViolationSettlementRepository repository) {
        this.repository = repository;
    }

    public Page<ViolationSettlementRecord> searchRecords(
            LocalDateTime fromDate,
            LocalDateTime toDate,
            String plazaId,
            String status,
            String vrn,
            String tagId,
            String acqTxnId,
            Pageable pageable) {

        Specification<ViolationSettlementRecord> spec = buildSpecification(fromDate, toDate, plazaId, status, vrn, tagId, acqTxnId);
        return repository.findAll(spec, pageable);
    }

    public Map<String, Object> calculateSummary(
            LocalDateTime fromDate,
            LocalDateTime toDate,
            String plazaId,
            String status,
            String vrn,
            String tagId,
            String acqTxnId) {

        Specification<ViolationSettlementRecord> spec = buildSpecification(fromDate, toDate, plazaId, status, vrn, tagId, acqTxnId);
        List<ViolationSettlementRecord> records = repository.findAll(spec);

        long totalCount = records.size();
        BigDecimal totalTxnAmount = BigDecimal.ZERO;
        BigDecimal totalAdjustmentAmount = BigDecimal.ZERO;
        BigDecimal totalSettlementAmount = BigDecimal.ZERO;

        for (ViolationSettlementRecord r : records) {
            BigDecimal txnAmt = r.getTxnAmount() != null ? r.getTxnAmount() : BigDecimal.ZERO;
            BigDecimal adjAmt = r.getViolationAdjustmentAmount() != null ? r.getViolationAdjustmentAmount() : BigDecimal.ZERO;
            BigDecimal setAmt = r.getViolationSettlementAmount() != null ? r.getViolationSettlementAmount() : BigDecimal.ZERO;

            totalTxnAmount = totalTxnAmount.add(txnAmt);
            totalAdjustmentAmount = totalAdjustmentAmount.add(adjAmt);
            totalSettlementAmount = totalSettlementAmount.add(setAmt);
        }

        Map<String, Object> summary = new HashMap<>();
        summary.put("totalCount", totalCount);
        summary.put("totalTxnAmount", totalTxnAmount);
        summary.put("totalAdjustmentAmount", totalAdjustmentAmount);
        summary.put("totalSettlementAmount", totalSettlementAmount);
        return summary;
    }

    public void streamExcelExport(
            LocalDateTime fromDate,
            LocalDateTime toDate,
            String plazaId,
            String status,
            String vrn,
            String tagId,
            String acqTxnId,
            OutputStream outputStream) throws Exception {

        Specification<ViolationSettlementRecord> spec = buildSpecification(fromDate, toDate, plazaId, status, vrn, tagId, acqTxnId);
        List<ViolationSettlementRecord> records = repository.findAll(spec);

        try (SXSSFWorkbook workbook = new SXSSFWorkbook(100)) {
            Sheet sheet = workbook.createSheet("Violation Settlement Report");
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

            // Green accent line
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

            String[] headers = {
                "Sr No", "Plaza Id", "Plaza Name", "Tag_Id", "VRN", "ACQ Txn ID",
                "Toll Txn ID", "Txn Date Time", "MVC", "AVC", "AuditVC", "Audit Remark",
                "NPCI Violation Status", "Txn Amt", "Violation Adjustment Amount",
                "Violation Settlement Amount", "Settlement Date", "Img Received Time"
            };

            // Row 0: Title Banner
            Row titleRow = sheet.createRow(0);
            titleRow.setHeightInPoints(32);
            Cell titleCell = titleRow.createCell(0);
            titleCell.setCellValue("VIOLATION SETTLEMENT REPORT");
            titleCell.setCellStyle(titleStyle);
            sheet.addMergedRegion(new CellRangeAddress(0, 0, 0, headers.length - 1));

            // Row 1: Subtitle
            Row subTitleRow = sheet.createRow(1);
            subTitleRow.setHeightInPoints(20);
            Cell subTitleCell = subTitleRow.createCell(0);
            subTitleCell.setCellValue("From Date: " + fromDate.format(DATE_TIME_FMT) + " | To Date: " + toDate.format(DATE_TIME_FMT) + " | Report Fetch Time: " + LocalDateTime.now().format(DATE_TIME_FMT));
            subTitleCell.setCellStyle(subTitleStyle);
            sheet.addMergedRegion(new CellRangeAddress(1, 1, 0, headers.length - 1));

            // Row 2: Green accent separator
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
            int srNo = 1;
            long totalCount = 0;
            BigDecimal totalTxnAmount = BigDecimal.ZERO;
            BigDecimal totalAdjustmentAmount = BigDecimal.ZERO;
            BigDecimal totalSettlementAmount = BigDecimal.ZERO;

            for (ViolationSettlementRecord r : records) {
                totalCount++;
                BigDecimal txnAmt = r.getTxnAmount() != null ? r.getTxnAmount() : BigDecimal.ZERO;
                BigDecimal adjAmt = r.getViolationAdjustmentAmount() != null ? r.getViolationAdjustmentAmount() : BigDecimal.ZERO;
                BigDecimal setAmt = r.getViolationSettlementAmount() != null ? r.getViolationSettlementAmount() : BigDecimal.ZERO;

                totalTxnAmount = totalTxnAmount.add(txnAmt);
                totalAdjustmentAmount = totalAdjustmentAmount.add(adjAmt);
                totalSettlementAmount = totalSettlementAmount.add(setAmt);

                Row row = sheet.createRow(rowIdx);

                // 0. Sr No
                Cell c0 = row.createCell(0); c0.setCellValue(srNo++); c0.setCellStyle(centerStyle);
                // 1. Plaza Id
                Cell c1 = row.createCell(1); c1.setCellValue(blankIfNull(r.getPlazaId())); c1.setCellStyle(centerStyle);
                // 2. Plaza Name
                Cell c2 = row.createCell(2); c2.setCellValue(blankIfNull(r.getPlazaName())); c2.setCellStyle(textStyle);
                // 3. Tag_Id
                Cell c3 = row.createCell(3); c3.setCellValue(blankIfNull(r.getTagId())); c3.setCellStyle(textStyle);
                // 4. VRN
                Cell c4 = row.createCell(4); c4.setCellValue(blankIfNull(r.getVrn())); c4.setCellStyle(centerStyle);
                // 5. ACQ Txn ID
                Cell c5 = row.createCell(5); c5.setCellValue(blankIfNull(r.getAcqTxnId())); c5.setCellStyle(centerStyle);
                // 6. Toll Txn ID
                Cell c6 = row.createCell(6); c6.setCellValue(blankIfNull(r.getTollTxnId())); c6.setCellStyle(centerStyle);
                // 7. Txn Date Time
                Cell c7 = row.createCell(7); c7.setCellValue(formatDateTime(r.getTxnDateTime())); c7.setCellStyle(centerStyle);
                // 8. MVC
                Cell c8 = row.createCell(8); c8.setCellValue(blankIfNull(r.getMvc())); c8.setCellStyle(centerStyle);
                // 9. AVC
                Cell c9 = row.createCell(9); c9.setCellValue(blankIfNull(r.getAvc())); c9.setCellStyle(centerStyle);
                // 10. AuditVC
                Cell c10 = row.createCell(10); c10.setCellValue(blankIfNull(r.getAuditVc())); c10.setCellStyle(centerStyle);
                // 11. Audit Remark
                Cell c11 = row.createCell(11); c11.setCellValue(blankIfNull(r.getAuditRemark())); c11.setCellStyle(centerStyle);
                // 12. NPCI Violation Status
                Cell c12 = row.createCell(12);
                String st = blankIfNull(r.getNpciViolationStatus());
                c12.setCellValue(st);
                if ("ACCEPTED".equalsIgnoreCase(st)) c12.setCellStyle(acceptedStyle);
                else c12.setCellStyle(centerStyle);
                // 13. Txn Amt
                Cell c13 = row.createCell(13); c13.setCellValue(txnAmt.doubleValue()); c13.setCellStyle(numberStyle);
                // 14. Violation Adjustment Amount
                Cell c14 = row.createCell(14); c14.setCellValue(adjAmt.doubleValue()); c14.setCellStyle(numberStyle);
                // 15. Violation Settlement Amount
                Cell c15 = row.createCell(15); c15.setCellValue(setAmt.doubleValue()); c15.setCellStyle(numberStyle);
                // 16. Settlement Date
                Cell c16 = row.createCell(16); c16.setCellValue(formatDateOnly(r.getSettlementDate())); c16.setCellStyle(centerStyle);
                // 17. Img Received Time
                Cell c17 = row.createCell(17); c17.setCellValue(formatDateTime(r.getImgReceivedTime())); c17.setCellStyle(centerStyle);

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
            k1.setCellValue("Total Records: " + totalCount);
            k1.setCellStyle(greenKpiStyle);
            sheet.addMergedRegion(new CellRangeAddress(rowIdx, rowIdx, 0, 4));

            Cell k2 = summaryRow.createCell(5);
            k2.setCellValue(String.format("Total Txn Amt: %.2f", totalTxnAmount.doubleValue()));
            k2.setCellStyle(blueKpiStyle);
            sheet.addMergedRegion(new CellRangeAddress(rowIdx, rowIdx, 5, 8));

            Cell k3 = summaryRow.createCell(9);
            k3.setCellValue(String.format("Total Adjustment: %.2f", totalAdjustmentAmount.doubleValue()));
            k3.setCellStyle(greenKpiStyle);
            sheet.addMergedRegion(new CellRangeAddress(rowIdx, rowIdx, 9, 13));

            Cell k4 = summaryRow.createCell(14);
            k4.setCellValue(String.format("Total Settlement: %.2f", totalSettlementAmount.doubleValue()));
            k4.setCellStyle(blueKpiStyle);
            sheet.addMergedRegion(new CellRangeAddress(rowIdx, rowIdx, 14, headers.length - 1));

            // Set column widths
            sheet.setColumnWidth(0, 2400);  // Sr No
            sheet.setColumnWidth(1, 3200);  // Plaza Id
            sheet.setColumnWidth(2, 5800);  // Plaza Name
            sheet.setColumnWidth(3, 7500);  // Tag_Id
            sheet.setColumnWidth(4, 4200);  // VRN
            sheet.setColumnWidth(5, 6500);  // ACQ Txn ID
            sheet.setColumnWidth(6, 4500);  // Toll Txn ID
            sheet.setColumnWidth(7, 5500);  // Txn Date Time
            sheet.setColumnWidth(8, 2500);  // MVC
            sheet.setColumnWidth(9, 2500);  // AVC
            sheet.setColumnWidth(10, 2800); // AuditVC
            sheet.setColumnWidth(11, 3500); // Audit Remark
            sheet.setColumnWidth(12, 4500); // NPCI Violation Status
            sheet.setColumnWidth(13, 3500); // Txn Amt
            sheet.setColumnWidth(14, 5500); // Violation Adjustment Amount
            sheet.setColumnWidth(15, 5500); // Violation Settlement Amount
            sheet.setColumnWidth(16, 4200); // Settlement Date
            sheet.setColumnWidth(17, 4500); // Img Received Time

            workbook.write(outputStream);
        }
    }

    public void streamCsvExport(
            LocalDateTime fromDate,
            LocalDateTime toDate,
            String plazaId,
            String status,
            String vrn,
            String tagId,
            String acqTxnId,
            OutputStream outputStream) throws Exception {

        Specification<ViolationSettlementRecord> spec = buildSpecification(fromDate, toDate, plazaId, status, vrn, tagId, acqTxnId);
        List<ViolationSettlementRecord> records = repository.findAll(spec);

        outputStream.write(new byte[]{(byte) 0xEF, (byte) 0xBB, (byte) 0xBF});

        try (PrintWriter writer = new PrintWriter(outputStream, true, StandardCharsets.UTF_8)) {
            writer.println("\"VIOLATION SETTLEMENT REPORT\"");
            writer.println("\"From Date: " + fromDate.format(DATE_TIME_FMT) + " | To Date: " + toDate.format(DATE_TIME_FMT) + " | Report Fetch Time: " + LocalDateTime.now().format(DATE_TIME_FMT) + "\"");
            writer.println();

            String[] headers = {
                "Sr No", "Plaza Id", "Plaza Name", "Tag_Id", "VRN", "ACQ Txn ID",
                "Toll Txn ID", "Txn Date Time", "MVC", "AVC", "AuditVC", "Audit Remark",
                "NPCI Violation Status", "Txn Amt", "Violation Adjustment Amount",
                "Violation Settlement Amount", "Settlement Date", "Img Received Time"
            };
            writer.println(String.join(",", escapeHeaders(headers)));

            int srNo = 1;
            long totalCount = 0;
            BigDecimal totalTxnAmount = BigDecimal.ZERO;
            BigDecimal totalAdjustmentAmount = BigDecimal.ZERO;
            BigDecimal totalSettlementAmount = BigDecimal.ZERO;

            for (ViolationSettlementRecord r : records) {
                totalCount++;
                BigDecimal txnAmt = r.getTxnAmount() != null ? r.getTxnAmount() : BigDecimal.ZERO;
                BigDecimal adjAmt = r.getViolationAdjustmentAmount() != null ? r.getViolationAdjustmentAmount() : BigDecimal.ZERO;
                BigDecimal setAmt = r.getViolationSettlementAmount() != null ? r.getViolationSettlementAmount() : BigDecimal.ZERO;

                totalTxnAmount = totalTxnAmount.add(txnAmt);
                totalAdjustmentAmount = totalAdjustmentAmount.add(adjAmt);
                totalSettlementAmount = totalSettlementAmount.add(setAmt);

                String[] row = {
                    String.valueOf(srNo++),
                    csvEscape(blankIfNull(r.getPlazaId())),
                    csvEscape(blankIfNull(r.getPlazaName())),
                    csvEscape(blankIfNull(r.getTagId())),
                    csvEscape(blankIfNull(r.getVrn())),
                    csvEscape(blankIfNull(r.getAcqTxnId())),
                    csvEscape(blankIfNull(r.getTollTxnId())),
                    csvEscape(formatDateTime(r.getTxnDateTime())),
                    csvEscape(blankIfNull(r.getMvc())),
                    csvEscape(blankIfNull(r.getAvc())),
                    csvEscape(blankIfNull(r.getAuditVc())),
                    csvEscape(blankIfNull(r.getAuditRemark())),
                    csvEscape(blankIfNull(r.getNpciViolationStatus())),
                    txnAmt.toString(),
                    adjAmt.toString(),
                    setAmt.toString(),
                    csvEscape(formatDateOnly(r.getSettlementDate())),
                    csvEscape(formatDateTime(r.getImgReceivedTime()))
                };
                writer.println(String.join(",", row));
            }

            writer.println();
            writer.println("\"--- SUMMARY KPIS ---\"");
            writer.println("\"Total Records\"," + totalCount);
            writer.println("\"Total Txn Amount\"," + String.format("%.2f", totalTxnAmount.doubleValue()));
            writer.println("\"Total Adjustment Amount\"," + String.format("%.2f", totalAdjustmentAmount.doubleValue()));
            writer.println("\"Total Settlement Amount\"," + String.format("%.2f", totalSettlementAmount.doubleValue()));
            writer.println("\"DataSource\",\"Live Railway MySQL DB: ONLINE\"");
            writer.flush();
        }
    }

    private Specification<ViolationSettlementRecord> buildSpecification(
            LocalDateTime fromDate,
            LocalDateTime toDate,
            String plazaId,
            String status,
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

            if (status != null && !status.isBlank() && !"ALL".equalsIgnoreCase(status)) {
                predicates.add(cb.equal(cb.upper(root.get("npciViolationStatus")), status.trim().toUpperCase()));
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

    private String formatDateTime(LocalDateTime dt) {
        return dt != null ? dt.format(DATE_TIME_FMT) : "";
    }

    private String formatDateOnly(LocalDate d) {
        return d != null ? d.format(DATE_ONLY_FMT) : "";
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
