package com.paysonic.tollops.service;

import com.paysonic.tollops.entity.ViolationRawRecord;
import com.paysonic.tollops.repository.ViolationRawRecordRepository;
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
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class ViolationRawFileService {

    private static final Logger log = LoggerFactory.getLogger(ViolationRawFileService.class);
    private final ViolationRawRecordRepository repository;

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("dd-MM-yyyy HH:mm:ss");

    public ViolationRawFileService(ViolationRawRecordRepository repository) {
        this.repository = repository;
    }

    public Page<ViolationRawRecord> searchRecords(
            LocalDateTime fromDate,
            LocalDateTime toDate,
            String plazaId,
            String functionCode,
            String tagId,
            String txnId,
            String mmt,
            Pageable pageable) {

        Specification<ViolationRawRecord> spec = buildSpecification(fromDate, toDate, plazaId, functionCode, tagId, txnId, mmt);
        return repository.findAll(spec, pageable);
    }

    public Map<String, Object> calculateSummary(
            LocalDateTime fromDate,
            LocalDateTime toDate,
            String plazaId,
            String functionCode,
            String tagId,
            String txnId,
            String mmt) {

        Specification<ViolationRawRecord> spec = buildSpecification(fromDate, toDate, plazaId, functionCode, tagId, txnId, mmt);
        List<ViolationRawRecord> records = repository.findAll(spec);

        long totalCount = records.size();
        BigDecimal totalAmount = BigDecimal.ZERO;
        long uniquePlazas = records.stream().map(ViolationRawRecord::getTollPlazaId).distinct().count();

        for (ViolationRawRecord r : records) {
            BigDecimal amt = r.getTxnAmount() != null ? r.getTxnAmount() : BigDecimal.ZERO;
            totalAmount = totalAmount.add(amt);
        }

        Map<String, Object> summary = new HashMap<>();
        summary.put("totalCount", totalCount);
        summary.put("totalAmount", totalAmount);
        summary.put("uniquePlazas", uniquePlazas);
        return summary;
    }

    public void streamExcelExport(
            LocalDateTime fromDate,
            LocalDateTime toDate,
            String plazaId,
            String functionCode,
            String tagId,
            String txnId,
            String mmt,
            OutputStream outputStream) throws Exception {

        Specification<ViolationRawRecord> spec = buildSpecification(fromDate, toDate, plazaId, functionCode, tagId, txnId, mmt);
        List<ViolationRawRecord> records = repository.findAll(spec);

        try (SXSSFWorkbook workbook = new SXSSFWorkbook(100)) {
            Sheet sheet = workbook.createSheet("Violation Raw File");
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

            String[] headers = {
                "Tag_ID", "Function_Code", "Txn_Time", "Txn_Id",
                "Issuer_ID", "Acquirer_ID", "Txn_Amount", "Reason_Code",
                "Full_Partial_Indicator", "Toll_Plaza_Id", "TID",
                "MMT", "Internal Tracking Number"
            };

            // Row 0: Title Banner
            Row titleRow = sheet.createRow(0);
            titleRow.setHeightInPoints(32);
            Cell titleCell = titleRow.createCell(0);
            titleCell.setCellValue("VIOLATION RAW FILE REPORT");
            titleCell.setCellStyle(titleStyle);
            sheet.addMergedRegion(new CellRangeAddress(0, 0, 0, headers.length - 1));

            // Row 1: Subtitle
            Row subTitleRow = sheet.createRow(1);
            subTitleRow.setHeightInPoints(20);
            Cell subTitleCell = subTitleRow.createCell(0);
            subTitleCell.setCellValue("From Date: " + fromDate.format(DATE_FMT) + " | To Date: " + toDate.format(DATE_FMT));
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
            long totalCount = 0;
            BigDecimal totalAmount = BigDecimal.ZERO;

            for (ViolationRawRecord r : records) {
                totalCount++;
                BigDecimal amt = r.getTxnAmount() != null ? r.getTxnAmount() : BigDecimal.ZERO;
                totalAmount = totalAmount.add(amt);

                Row row = sheet.createRow(rowIdx);

                // 0. Tag_ID
                Cell c0 = row.createCell(0); c0.setCellValue(blankIfNull(r.getTagId())); c0.setCellStyle(textStyle);
                // 1. Function_Code
                Cell c1 = row.createCell(1); c1.setCellValue(blankIfNull(r.getFunctionCode())); c1.setCellStyle(centerStyle);
                // 2. Txn_Time
                Cell c2 = row.createCell(2); c2.setCellValue(blankIfNull(r.getTxnTime())); c2.setCellStyle(centerStyle);
                // 3. Txn_Id
                Cell c3 = row.createCell(3); c3.setCellValue(blankIfNull(r.getTxnId())); c3.setCellStyle(centerStyle);
                // 4. Issuer_ID
                Cell c4 = row.createCell(4); c4.setCellValue(blankIfNull(r.getIssuerId())); c4.setCellStyle(centerStyle);
                // 5. Acquirer_ID
                Cell c5 = row.createCell(5); c5.setCellValue(blankIfNull(r.getAcquirerId())); c5.setCellStyle(centerStyle);
                // 6. Txn_Amount
                Cell c6 = row.createCell(6); c6.setCellValue(amt.doubleValue()); c6.setCellStyle(numberStyle);
                // 7. Reason_Code
                Cell c7 = row.createCell(7); c7.setCellValue(blankIfNull(r.getReasonCode())); c7.setCellStyle(centerStyle);
                // 8. Full_Partial_Indicator
                Cell c8 = row.createCell(8); c8.setCellValue(blankIfNull(r.getFullPartialIndicator())); c8.setCellStyle(centerStyle);
                // 9. Toll_Plaza_Id
                Cell c9 = row.createCell(9); c9.setCellValue(blankIfNull(r.getTollPlazaId())); c9.setCellStyle(centerStyle);
                // 10. TID
                Cell c10 = row.createCell(10); c10.setCellValue(blankIfNull(r.getTid())); c10.setCellStyle(textStyle);
                // 11. MMT
                Cell c11 = row.createCell(11); c11.setCellValue(blankIfNull(r.getMmt())); c11.setCellStyle(centerStyle);
                // 12. Internal Tracking Number
                Cell c12 = row.createCell(12); c12.setCellValue(blankIfNull(r.getInternalTrackingNumber())); c12.setCellStyle(centerStyle);

                rowIdx++;
            }

            // Summary row at bottom
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
            k1.setCellValue("Total Raw Records: " + totalCount);
            k1.setCellStyle(greenKpiStyle);
            sheet.addMergedRegion(new CellRangeAddress(rowIdx, rowIdx, 0, 5));

            Cell k2 = summaryRow.createCell(6);
            k2.setCellValue(String.format("Total Txn Amount: %.2f", totalAmount.doubleValue()));
            k2.setCellStyle(blueKpiStyle);
            sheet.addMergedRegion(new CellRangeAddress(rowIdx, rowIdx, 6, headers.length - 1));

            // Set column widths
            sheet.setColumnWidth(0, 7500);  // Tag_ID
            sheet.setColumnWidth(1, 3800);  // Function_Code
            sheet.setColumnWidth(2, 4200);  // Txn_Time
            sheet.setColumnWidth(3, 6500);  // Txn_Id
            sheet.setColumnWidth(4, 3200);  // Issuer_ID
            sheet.setColumnWidth(5, 3200);  // Acquirer_ID
            sheet.setColumnWidth(6, 4000);  // Txn_Amount
            sheet.setColumnWidth(7, 3500);  // Reason_Code
            sheet.setColumnWidth(8, 5000);  // Full_Partial_Indicator
            sheet.setColumnWidth(9, 3500);  // Toll_Plaza_Id
            sheet.setColumnWidth(10, 7500); // TID
            sheet.setColumnWidth(11, 4000); // MMT
            sheet.setColumnWidth(12, 6000); // Internal Tracking Number

            workbook.write(outputStream);
        }
    }

    public void streamCsvExport(
            LocalDateTime fromDate,
            LocalDateTime toDate,
            String plazaId,
            String functionCode,
            String tagId,
            String txnId,
            String mmt,
            OutputStream outputStream) throws Exception {

        Specification<ViolationRawRecord> spec = buildSpecification(fromDate, toDate, plazaId, functionCode, tagId, txnId, mmt);
        List<ViolationRawRecord> records = repository.findAll(spec);

        outputStream.write(new byte[]{(byte) 0xEF, (byte) 0xBB, (byte) 0xBF});

        try (PrintWriter writer = new PrintWriter(outputStream, true, StandardCharsets.UTF_8)) {
            writer.println("\"VIOLATION RAW FILE REPORT\"");
            writer.println("\"From Date: " + fromDate.format(DATE_FMT) + " | To Date: " + toDate.format(DATE_FMT) + "\"");
            writer.println();

            String[] headers = {
                "Tag_ID", "Function_Code", "Txn_Time", "Txn_Id",
                "Issuer_ID", "Acquirer_ID", "Txn_Amount", "Reason_Code",
                "Full_Partial_Indicator", "Toll_Plaza_Id", "TID",
                "MMT", "Internal Tracking Number"
            };
            writer.println(String.join(",", escapeHeaders(headers)));

            long totalCount = 0;
            BigDecimal totalAmount = BigDecimal.ZERO;

            for (ViolationRawRecord r : records) {
                totalCount++;
                BigDecimal amt = r.getTxnAmount() != null ? r.getTxnAmount() : BigDecimal.ZERO;
                totalAmount = totalAmount.add(amt);

                String[] row = {
                    csvEscape(blankIfNull(r.getTagId())),
                    csvEscape(blankIfNull(r.getFunctionCode())),
                    csvEscape(blankIfNull(r.getTxnTime())),
                    csvEscape(blankIfNull(r.getTxnId())),
                    csvEscape(blankIfNull(r.getIssuerId())),
                    csvEscape(blankIfNull(r.getAcquirerId())),
                    amt.toString(),
                    csvEscape(blankIfNull(r.getReasonCode())),
                    csvEscape(blankIfNull(r.getFullPartialIndicator())),
                    csvEscape(blankIfNull(r.getTollPlazaId())),
                    csvEscape(blankIfNull(r.getTid())),
                    csvEscape(blankIfNull(r.getMmt())),
                    csvEscape(blankIfNull(r.getInternalTrackingNumber()))
                };
                writer.println(String.join(",", row));
            }

            writer.println();
            writer.println("\"--- SUMMARY KPIS ---\"");
            writer.println("\"Total Raw Records\"," + totalCount);
            writer.println("\"Total Txn Amount\"," + String.format("%.2f", totalAmount.doubleValue()));
            writer.println("\"DataSource\",\"Live Railway MySQL DB: ONLINE\"");
            writer.flush();
        }
    }

    public void streamRawTextExport(
            LocalDateTime fromDate,
            LocalDateTime toDate,
            String plazaId,
            String functionCode,
            String tagId,
            String txnId,
            String mmt,
            OutputStream outputStream) throws Exception {

        Specification<ViolationRawRecord> spec = buildSpecification(fromDate, toDate, plazaId, functionCode, tagId, txnId, mmt);
        List<ViolationRawRecord> records = repository.findAll(spec);

        try (PrintWriter writer = new PrintWriter(outputStream, true, StandardCharsets.UTF_8)) {
            // Standard NETC format: header and pipe-delimited records
            writer.println("Tag_ID|Function_Code|Txn_Time|Txn_Id|Issuer_ID|Acquirer_ID|Txn_Amount|Reason_Code|Full_Partial_Indicator|Toll_Plaza_Id|TID|MMT|Internal_Tracking_Number");
            for (ViolationRawRecord r : records) {
                BigDecimal amt = r.getTxnAmount() != null ? r.getTxnAmount() : BigDecimal.ZERO;
                writer.println(String.format("%s|%s|%s|%s|%s|%s|%.2f|%s|%s|%s|%s|%s|%s",
                        blankIfNull(r.getTagId()),
                        blankIfNull(r.getFunctionCode()),
                        blankIfNull(r.getTxnTime()),
                        blankIfNull(r.getTxnId()),
                        blankIfNull(r.getIssuerId()),
                        blankIfNull(r.getAcquirerId()),
                        amt,
                        blankIfNull(r.getReasonCode()),
                        blankIfNull(r.getFullPartialIndicator()),
                        blankIfNull(r.getTollPlazaId()),
                        blankIfNull(r.getTid()),
                        blankIfNull(r.getMmt()),
                        blankIfNull(r.getInternalTrackingNumber())
                ));
            }
            writer.flush();
        }
    }

    private Specification<ViolationRawRecord> buildSpecification(
            LocalDateTime fromDate,
            LocalDateTime toDate,
            String plazaId,
            String functionCode,
            String tagId,
            String txnId,
            String mmt) {

        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            if (fromDate != null && toDate != null) {
                predicates.add(cb.between(root.get("parsedDateTime"), fromDate, toDate));
            } else if (fromDate != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("parsedDateTime"), fromDate));
            } else if (toDate != null) {
                predicates.add(cb.lessThanOrEqualTo(root.get("parsedDateTime"), toDate));
            }

            if (plazaId != null && !plazaId.isBlank() && !"ALL".equalsIgnoreCase(plazaId)) {
                predicates.add(cb.equal(root.get("tollPlazaId"), plazaId.trim()));
            }

            if (functionCode != null && !functionCode.isBlank() && !"ALL".equalsIgnoreCase(functionCode)) {
                predicates.add(cb.equal(root.get("functionCode"), functionCode.trim()));
            }

            boolean tagPresent = tagId != null && !tagId.isBlank();
            boolean txnPresent = txnId != null && !txnId.isBlank();
            boolean mmtPresent = mmt != null && !mmt.isBlank();

            if (tagPresent && txnPresent && tagId.trim().equalsIgnoreCase(txnId.trim())) {
                String term = tagId.trim().toLowerCase();
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("tagId")), "%" + term + "%"),
                        cb.like(cb.lower(root.get("txnId")), "%" + term + "%"),
                        cb.like(cb.lower(root.get("mmt")), "%" + term + "%"),
                        cb.like(cb.lower(root.get("tid")), "%" + term + "%")
                ));
            } else {
                if (tagPresent) {
                    predicates.add(cb.like(cb.lower(root.get("tagId")), "%" + tagId.trim().toLowerCase() + "%"));
                }
                if (txnPresent) {
                    predicates.add(cb.like(cb.lower(root.get("txnId")), "%" + txnId.trim().toLowerCase() + "%"));
                }
                if (mmtPresent) {
                    predicates.add(cb.like(cb.lower(root.get("mmt")), "%" + mmt.trim().toLowerCase() + "%"));
                }
            }

            return cb.and(predicates.toArray(new Predicate[0]));
        };
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
