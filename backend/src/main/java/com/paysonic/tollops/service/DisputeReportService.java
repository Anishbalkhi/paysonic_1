package com.paysonic.tollops.service;

import com.paysonic.tollops.entity.DisputeTransaction;
import com.paysonic.tollops.repository.DisputeTransactionRepository;
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
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

@Service
public class DisputeReportService {

    private static final Logger log = LoggerFactory.getLogger(DisputeReportService.class);
    private final DisputeTransactionRepository repository;

    private static final DateTimeFormatter DATE_TIME_FMT = DateTimeFormatter.ofPattern("dd-MM-yyyy HH:mm:ss");
    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("dd-MM-yyyy");

    public DisputeReportService(DisputeTransactionRepository repository) {
        this.repository = repository;
    }

    public Page<DisputeTransaction> searchDisputes(
            LocalDateTime fromDate,
            LocalDateTime toDate,
            String plazaId,
            String functionCode,
            Pageable pageable) {

        Specification<DisputeTransaction> spec = buildSpecification(fromDate, toDate, plazaId, functionCode);
        return repository.findAll(spec, pageable);
    }

    public List<DisputeTransaction> getDisputesList(
            LocalDateTime fromDate,
            LocalDateTime toDate,
            String plazaId,
            String functionCode) {

        Specification<DisputeTransaction> spec = buildSpecification(fromDate, toDate, plazaId, functionCode);
        return repository.findAll(spec);
    }

    /**
     * Stream Excel file matching Image 2 reference:
     * - Top centered Royal Blue title: DISPUTE DETAIL REPORT
     * - Subtitle date range
     * - Vibrant Green accent bar
     * - Solid Royal Blue headers with white bold text
     * - Dr / Cr colored badges
     * - Bottom TOTAL row
     */
    public void streamExcelExport(
            LocalDateTime fromDate,
            LocalDateTime toDate,
            String plazaId,
            String functionCode,
            OutputStream outputStream) throws Exception {

        List<DisputeTransaction> records = getDisputesList(fromDate, toDate, plazaId, functionCode);

        try (SXSSFWorkbook workbook = new SXSSFWorkbook(100)) {
            Sheet sheet = workbook.createSheet("Dispute Detail Report");
            DataFormat dataFormat = workbook.createDataFormat();

            // 1. Title Style (Bold Royal Blue, 16pt, Centered)
            CellStyle titleStyle = workbook.createCellStyle();
            Font titleFont = workbook.createFont();
            titleFont.setFontName("Calibri");
            titleFont.setFontHeightInPoints((short) 16);
            titleFont.setBold(true);
            titleFont.setColor(IndexedColors.DARK_BLUE.getIndex());
            titleStyle.setFont(titleFont);
            titleStyle.setAlignment(HorizontalAlignment.CENTER);
            titleStyle.setVerticalAlignment(VerticalAlignment.CENTER);

            // 2. Subtitle Date Range Style (Muted Grey, 10pt, Centered)
            CellStyle subTitleStyle = workbook.createCellStyle();
            Font subFont = workbook.createFont();
            subFont.setFontName("Calibri");
            subFont.setFontHeightInPoints((short) 10);
            subFont.setColor(IndexedColors.GREY_50_PERCENT.getIndex());
            subTitleStyle.setFont(subFont);
            subTitleStyle.setAlignment(HorizontalAlignment.CENTER);
            subTitleStyle.setVerticalAlignment(VerticalAlignment.CENTER);

            // 3. Green Accent Line Style (Solid Green fill)
            CellStyle greenBarStyle = workbook.createCellStyle();
            greenBarStyle.setFillForegroundColor(IndexedColors.GREEN.getIndex());
            greenBarStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);

            // 4. Header Style (Deep Royal Blue fill, Bold White text, Centered, Borders)
            CellStyle headerStyle = workbook.createCellStyle();
            Font headerFont = workbook.createFont();
            headerFont.setFontName("Calibri");
            headerFont.setFontHeightInPoints((short) 11);
            headerFont.setBold(true);
            headerFont.setColor(IndexedColors.WHITE.getIndex());
            headerStyle.setFont(headerFont);
            headerStyle.setFillForegroundColor(IndexedColors.DARK_BLUE.getIndex());
            headerStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            headerStyle.setAlignment(HorizontalAlignment.CENTER);
            headerStyle.setVerticalAlignment(VerticalAlignment.CENTER);
            headerStyle.setBorderBottom(BorderStyle.THIN);
            headerStyle.setBorderTop(BorderStyle.THIN);
            headerStyle.setBorderLeft(BorderStyle.THIN);
            headerStyle.setBorderRight(BorderStyle.THIN);

            // 5. Data Cell Styles
            CellStyle textStyle = workbook.createCellStyle();
            textStyle.setDataFormat(dataFormat.getFormat("@"));
            textStyle.setVerticalAlignment(VerticalAlignment.CENTER);
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

            // 6. Debit (Dr) Badge: Soft Red (#FFE2E2 -> ROSE), Dark Red text
            CellStyle drStyle = workbook.createCellStyle();
            drStyle.setFillForegroundColor(IndexedColors.ROSE.getIndex());
            drStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            drStyle.setAlignment(HorizontalAlignment.CENTER);
            drStyle.setVerticalAlignment(VerticalAlignment.CENTER);
            drStyle.setBorderBottom(BorderStyle.THIN);
            drStyle.setBorderTop(BorderStyle.THIN);
            drStyle.setBorderLeft(BorderStyle.THIN);
            drStyle.setBorderRight(BorderStyle.THIN);
            Font drFont = workbook.createFont();
            drFont.setBold(true);
            drFont.setColor(IndexedColors.DARK_RED.getIndex());
            drStyle.setFont(drFont);

            // 7. Credit (Cr) Badge: Soft Green (#DCFCE7 -> LIGHT_GREEN), Dark Green text
            CellStyle crStyle = workbook.createCellStyle();
            crStyle.setFillForegroundColor(IndexedColors.LIGHT_GREEN.getIndex());
            crStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            crStyle.setAlignment(HorizontalAlignment.CENTER);
            crStyle.setVerticalAlignment(VerticalAlignment.CENTER);
            crStyle.setBorderBottom(BorderStyle.THIN);
            crStyle.setBorderTop(BorderStyle.THIN);
            crStyle.setBorderLeft(BorderStyle.THIN);
            crStyle.setBorderRight(BorderStyle.THIN);
            Font crFont = workbook.createFont();
            crFont.setBold(true);
            crFont.setColor(IndexedColors.DARK_GREEN.getIndex());
            crStyle.setFont(crFont);

            // 8. Total Summary Style
            CellStyle totalLabelStyle = workbook.createCellStyle();
            Font totalFont = workbook.createFont();
            totalFont.setBold(true);
            totalLabelStyle.setFont(totalFont);
            totalLabelStyle.setAlignment(HorizontalAlignment.CENTER);
            totalLabelStyle.setVerticalAlignment(VerticalAlignment.CENTER);
            totalLabelStyle.setBorderBottom(BorderStyle.THIN);
            totalLabelStyle.setBorderTop(BorderStyle.THIN);
            totalLabelStyle.setBorderLeft(BorderStyle.THIN);
            totalLabelStyle.setBorderRight(BorderStyle.THIN);

            CellStyle totalNumStyle = workbook.createCellStyle();
            totalNumStyle.setFont(totalFont);
            totalNumStyle.setDataFormat(dataFormat.getFormat("#,##0.00"));
            totalNumStyle.setAlignment(HorizontalAlignment.RIGHT);
            totalNumStyle.setVerticalAlignment(VerticalAlignment.CENTER);
            totalNumStyle.setBorderBottom(BorderStyle.THIN);
            totalNumStyle.setBorderTop(BorderStyle.THIN);
            totalNumStyle.setBorderLeft(BorderStyle.THIN);
            totalNumStyle.setBorderRight(BorderStyle.THIN);

            String[] headers = {
                "Sr No", "Plaza Name", "Plaza ID", "Acq Txn ID", "Toll Txn ID",
                "Txn Date Time", "Txn Amount", "Dispute Amount", "Vehicle No",
                "Tag ID", "TID", "Issuer ID", "Int Tracking No", "Function Code",
                "Settlement Indicator", "Message Reason Code", "Member Message Text", "NPCI Settlement Date"
            };

            // Row 0: Title Banner (Centered across all columns)
            Row titleRow = sheet.createRow(0);
            titleRow.setHeightInPoints(28);
            Cell titleCell = titleRow.createCell(0);
            titleCell.setCellValue("DISPUTE DETAIL REPORT");
            titleCell.setCellStyle(titleStyle);
            sheet.addMergedRegion(new CellRangeAddress(0, 0, 0, headers.length - 1));

            // Row 1: Subtitle with Date Range (Centered across all columns)
            Row subRow = sheet.createRow(1);
            subRow.setHeightInPoints(18);
            Cell subCell = subRow.createCell(0);
            String fromStr = fromDate != null ? fromDate.format(DATE_TIME_FMT) : "01-09-2026 00:00:00";
            String toStr = toDate != null ? toDate.format(DATE_TIME_FMT) : "30-09-2026 23:59:59";
            String exportTimeStr = LocalDateTime.now().format(DATE_TIME_FMT);
            subCell.setCellValue("From Date: " + fromStr + "   |   To Date: " + toStr + "   |   Data Export Time: " + exportTimeStr);
            subCell.setCellStyle(subTitleStyle);
            sheet.addMergedRegion(new CellRangeAddress(1, 1, 0, headers.length - 1));

            // Row 2: Green Accent Bar
            Row greenRow = sheet.createRow(2);
            greenRow.setHeightInPoints(5);
            for (int i = 0; i < headers.length; i++) {
                Cell gc = greenRow.createCell(i);
                gc.setCellStyle(greenBarStyle);
            }

            // Row 3: Table Header Row
            Row headerRow = sheet.createRow(3);
            headerRow.setHeightInPoints(26);
            for (int i = 0; i < headers.length; i++) {
                Cell cell = headerRow.createCell(i);
                cell.setCellValue(headers[i]);
                cell.setCellStyle(headerStyle);
            }

            // Rows 4+: Data Rows
            int rowIdx = 4;
            int srNo = 1;
            BigDecimal totalTxnAmt = BigDecimal.ZERO;
            BigDecimal totalDispAmt = BigDecimal.ZERO;

            for (DisputeTransaction d : records) {
                Row row = sheet.createRow(rowIdx);
                row.setHeightInPoints(20);

                Cell c0 = row.createCell(0); c0.setCellValue(srNo++); c0.setCellStyle(centerStyle);
                Cell c1 = row.createCell(1); c1.setCellValue(blankIfNull(d.getPlazaName())); c1.setCellStyle(textStyle);
                Cell c2 = row.createCell(2); c2.setCellValue(blankIfNull(d.getPlazaId())); c2.setCellStyle(centerStyle);

                // Acq Txn ID (Text format)
                Cell acqCell = row.createCell(3);
                acqCell.setCellValue(blankIfNull(d.getAcqTxnId()));
                acqCell.setCellStyle(textStyle);

                Cell c4 = row.createCell(4); c4.setCellValue(blankIfNull(d.getTollTxnId())); c4.setCellStyle(centerStyle);
                Cell c5 = row.createCell(5); c5.setCellValue(formatDateTime(d.getTxnDateTime())); c5.setCellStyle(centerStyle);

                // Txn Amount
                Cell txnCell = row.createCell(6);
                txnCell.setCellStyle(numberStyle);
                if (d.getTxnAmount() != null) {
                    txnCell.setCellValue(d.getTxnAmount().doubleValue());
                    totalTxnAmt = totalTxnAmt.add(d.getTxnAmount());
                } else {
                    txnCell.setCellValue(0.0);
                }

                // Dispute Amount
                Cell dispCell = row.createCell(7);
                dispCell.setCellStyle(numberStyle);
                if (d.getDisputeAmount() != null) {
                    dispCell.setCellValue(d.getDisputeAmount().doubleValue());
                    totalDispAmt = totalDispAmt.add(d.getDisputeAmount());
                } else {
                    dispCell.setCellValue(0.0);
                }

                Cell c8 = row.createCell(8); c8.setCellValue(blankIfNull(d.getVehicleNo())); c8.setCellStyle(centerStyle);
                Cell c9 = row.createCell(9); c9.setCellValue(blankIfNull(d.getTagId())); c9.setCellStyle(textStyle);
                Cell c10 = row.createCell(10); c10.setCellValue(blankIfNull(d.getTid())); c10.setCellStyle(textStyle);
                Cell c11 = row.createCell(11); c11.setCellValue(blankIfNull(d.getIssuerId())); c11.setCellStyle(centerStyle);
                Cell c12 = row.createCell(12); c12.setCellValue(blankIfNull(d.getIntTrackingNo())); c12.setCellStyle(centerStyle);
                Cell c13 = row.createCell(13); c13.setCellValue(blankIfNull(d.getFunctionCode())); c13.setCellStyle(textStyle);

                // Settlement Indicator (Dr / Cr)
                Cell indCell = row.createCell(14);
                String ind = blankIfNull(d.getSettlementIndicator());
                indCell.setCellValue(ind);
                if ("Dr".equalsIgnoreCase(ind)) {
                    indCell.setCellStyle(drStyle);
                } else if ("Cr".equalsIgnoreCase(ind)) {
                    indCell.setCellStyle(crStyle);
                } else {
                    indCell.setCellStyle(centerStyle);
                }

                Cell c15 = row.createCell(15); c15.setCellValue(blankIfNull(d.getMessageReasonCode())); c15.setCellStyle(textStyle);
                Cell c16 = row.createCell(16); c16.setCellValue(blankIfNull(d.getMemberMessageText())); c16.setCellStyle(textStyle);
                Cell c17 = row.createCell(17); c17.setCellValue(formatDate(d.getNpciSettlementDate())); c17.setCellStyle(centerStyle);

                rowIdx++;
            }

            // Summary TOTAL Row
            Row totalRow = sheet.createRow(rowIdx);
            totalRow.setHeightInPoints(22);
            for (int i = 0; i < headers.length; i++) {
                Cell tc = totalRow.createCell(i);
                tc.setCellStyle(totalLabelStyle);
            }
            totalRow.getCell(0).setCellValue("TOTAL");
            totalRow.getCell(6).setCellValue(totalTxnAmt.doubleValue());
            totalRow.getCell(6).setCellStyle(totalNumStyle);
            totalRow.getCell(7).setCellValue(totalDispAmt.doubleValue());
            totalRow.getCell(7).setCellStyle(totalNumStyle);

            // Wide Column Widths preventing ########
            int[] colWidths = {
                8,  // Sr No
                22, // Plaza Name
                12, // Plaza ID
                24, // Acq Txn ID
                16, // Toll Txn ID
                22, // Txn Date Time
                16, // Txn Amount
                16, // Dispute Amount
                16, // Vehicle No
                30, // Tag ID
                26, // TID
                14, // Issuer ID
                16, // Int Tracking No
                26, // Function Code
                18, // Settlement Indicator
                22, // Message Reason Code
                32, // Member Message Text
                20  // NPCI Settlement Date
            };

            for (int i = 0; i < headers.length; i++) {
                int w = (i < colWidths.length) ? colWidths[i] : 18;
                sheet.setColumnWidth(i, w * 256);
            }

            workbook.write(outputStream);
            workbook.dispose();
            log.info("Streamed Dispute Detail Report Excel Export with {} records", records.size());
        }
    }

    /**
     * Stream CSV export matching screen 1:1 with UTF-8 BOM, centered banner, and summary total row
     */
    public void streamCsvExport(
            LocalDateTime fromDate,
            LocalDateTime toDate,
            String plazaId,
            String functionCode,
            OutputStream outputStream) throws Exception {

        List<DisputeTransaction> records = getDisputesList(fromDate, toDate, plazaId, functionCode);
        PrintWriter writer = new PrintWriter(outputStream, true);

        // Prepend UTF-8 BOM
        outputStream.write(0xEF);
        outputStream.write(0xBB);
        outputStream.write(0xBF);

        String[] headers = {
            "Sr No", "Plaza Name", "Plaza ID", "Acq Txn ID", "Toll Txn ID",
            "Txn Date Time", "Txn Amount", "Dispute Amount", "Vehicle No",
            "Tag ID", "TID", "Issuer ID", "Int Tracking No", "Function Code",
            "Settlement Indicator", "Message Reason Code", "Member Message Text", "NPCI Settlement Date"
        };

        String fromStr = fromDate != null ? fromDate.format(DATE_TIME_FMT) : "01-09-2026 00:00:00";
        String toStr = toDate != null ? toDate.format(DATE_TIME_FMT) : "30-09-2026 23:59:59";
        String exportTimeStr = LocalDateTime.now().format(DATE_TIME_FMT);
        int midIdx = headers.length / 2;

        // Centered Banner Rows
        String[] titleLine = new String[headers.length];
        String[] subLine = new String[headers.length];
        for (int i = 0; i < headers.length; i++) {
            titleLine[i] = "";
            subLine[i] = "";
        }
        titleLine[midIdx] = "DISPUTE DETAIL REPORT";
        subLine[midIdx] = "From Date: " + fromStr + "   |   To Date: " + toStr + "   |   Data Export Time: " + exportTimeStr;

        writer.println(String.join(",", titleLine));
        writer.println(String.join(",", subLine));
        writer.println();
        writer.println(String.join(",", headers));

        BigDecimal totalTxnAmt = BigDecimal.ZERO;
        BigDecimal totalDispAmt = BigDecimal.ZERO;
        int srNo = 1;

        for (DisputeTransaction d : records) {
            BigDecimal tAmt = d.getTxnAmount() != null ? d.getTxnAmount() : BigDecimal.ZERO;
            BigDecimal dAmt = d.getDisputeAmount() != null ? d.getDisputeAmount() : BigDecimal.ZERO;
            totalTxnAmt = totalTxnAmt.add(tAmt);
            totalDispAmt = totalDispAmt.add(dAmt);

            String[] row = {
                String.valueOf(srNo++),
                escapeCsv(d.getPlazaName()),
                escapeCsv(d.getPlazaId()),
                escapeCsv(d.getAcqTxnId()),
                escapeCsv(d.getTollTxnId()),
                escapeCsv(formatDateTime(d.getTxnDateTime())),
                tAmt.setScale(2).toString(),
                dAmt.setScale(2).toString(),
                escapeCsv(d.getVehicleNo()),
                escapeCsv(d.getTagId()),
                escapeCsv(d.getTid()),
                escapeCsv(d.getIssuerId()),
                escapeCsv(d.getIntTrackingNo()),
                escapeCsv(d.getFunctionCode()),
                escapeCsv(d.getSettlementIndicator()),
                escapeCsv(d.getMessageReasonCode()),
                escapeCsv(d.getMemberMessageText()),
                escapeCsv(formatDate(d.getNpciSettlementDate()))
            };
            writer.println(String.join(",", row));
        }

        // Summary Total Row
        String[] totalRow = new String[headers.length];
        for (int i = 0; i < headers.length; i++) totalRow[i] = "";
        totalRow[0] = "TOTAL";
        totalRow[6] = totalTxnAmt.setScale(2).toString();
        totalRow[7] = totalDispAmt.setScale(2).toString();
        writer.println(String.join(",", totalRow));

        writer.flush();
        log.info("Streamed Dispute Detail Report CSV Export with {} records", records.size());
    }

    private Specification<DisputeTransaction> buildSpecification(
            LocalDateTime fromDate,
            LocalDateTime toDate,
            String plazaId,
            String functionCode) {

        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (fromDate != null && toDate != null) {
                predicates.add(cb.between(root.get("txnDateTime"), fromDate, toDate));
            } else if (fromDate != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("txnDateTime"), fromDate));
            } else if (toDate != null) {
                predicates.add(cb.lessThanOrEqualTo(root.get("txnDateTime"), toDate));
            }

            if (plazaId != null && !plazaId.trim().isEmpty() && !plazaId.equalsIgnoreCase("ALL")) {
                predicates.add(cb.equal(root.get("plazaId"), plazaId.trim()));
            }

            if (functionCode != null && !functionCode.trim().isEmpty() && !functionCode.equalsIgnoreCase("ALL")) {
                predicates.add(cb.equal(root.get("functionCode"), functionCode.trim()));
            }

            query.orderBy(cb.desc(root.get("txnDateTime")));
            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }

    private String formatDateTime(LocalDateTime dt) {
        return dt == null ? "" : dt.format(DATE_TIME_FMT);
    }

    private String formatDate(LocalDate d) {
        return d == null ? "" : d.format(DATE_FMT);
    }

    private String blankIfNull(String val) {
        return val == null ? "" : val;
    }

    private String escapeCsv(String val) {
        if (val == null) return "";
        if (val.contains(",") || val.contains("\"") || val.contains("\n") || val.contains("\r")) {
            return "\"" + val.replace("\"", "\"\"") + "\"";
        }
        return val;
    }
}
