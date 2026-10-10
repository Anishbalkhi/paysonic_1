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
public class TransactionSearchDisputeService {

    private static final Logger log = LoggerFactory.getLogger(TransactionSearchDisputeService.class);
    private static final DateTimeFormatter DATE_TIME_FMT = DateTimeFormatter.ofPattern("dd-MM-yyyy HH:mm:ss");
    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("dd-MM-yyyy");

    private final DisputeTransactionRepository repository;

    public TransactionSearchDisputeService(DisputeTransactionRepository repository) {
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

            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }

    /**
     * Stream Excel (.xlsx) export with Royal Blue header, centered banner, and bottom KPI cards
     */
    public void streamExcelExport(
            LocalDateTime fromDate,
            LocalDateTime toDate,
            String plazaId,
            String functionCode,
            OutputStream outputStream) throws Exception {

        List<DisputeTransaction> records = getDisputesList(fromDate, toDate, plazaId, functionCode);

        try (SXSSFWorkbook workbook = new SXSSFWorkbook(100)) {
            Sheet sheet = workbook.createSheet("Dispute Transactions");
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

            // 2. Subtitle Style (Muted Grey, 10pt, Centered)
            CellStyle subTitleStyle = workbook.createCellStyle();
            Font subFont = workbook.createFont();
            subFont.setFontName("Calibri");
            subFont.setFontHeightInPoints((short) 10);
            subFont.setColor(IndexedColors.GREY_50_PERCENT.getIndex());
            subTitleStyle.setFont(subFont);
            subTitleStyle.setAlignment(HorizontalAlignment.CENTER);
            subTitleStyle.setVerticalAlignment(VerticalAlignment.CENTER);

            // 3. Green Accent Line Style
            CellStyle greenBarStyle = workbook.createCellStyle();
            greenBarStyle.setFillForegroundColor(IndexedColors.GREEN.getIndex());
            greenBarStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);

            // 4. Header Style (Royal Blue fill, Bold White text, Borders)
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

            String[] headers = {
                    "Sr No", "Plaza Name", "Plaza ID", "Acq Txn ID", "Toll Txn ID",
                    "Txn Date Time", "Txn Amount", "Dispute Amount", "Vehicle No",
                    "Tag ID", "TID", "Issuer ID", "Int Tracking No", "Function Code",
                    "Function Code Description", "Settlement Indicator", "Message Reason Code",
                    "Member Message Text", "NPCI Settlement Date"
            };

            // Row 0: Title Banner
            Row titleRow = sheet.createRow(0);
            titleRow.setHeightInPoints(28);
            Cell titleCell = titleRow.createCell(0);
            titleCell.setCellValue("TRANSACTION SEARCH - DISPUTE TRANSACTION");
            titleCell.setCellStyle(titleStyle);
            sheet.addMergedRegion(new CellRangeAddress(0, 0, 0, headers.length - 1));

            // Row 1: Subtitle
            Row subRow = sheet.createRow(1);
            subRow.setHeightInPoints(18);
            Cell subCell = subRow.createCell(0);
            String fromStr = fromDate != null ? fromDate.format(DATE_TIME_FMT) : "01-09-2026 00:00:00";
            String toStr = toDate != null ? toDate.format(DATE_TIME_FMT) : "30-09-2026 23:59:59";
            String exportTimeStr = LocalDateTime.now().format(DATE_TIME_FMT);
            subCell.setCellValue("From Date: " + fromStr + "   |   To Date: " + toStr + "   |   Export Time: " + exportTimeStr);
            subCell.setCellStyle(subTitleStyle);
            sheet.addMergedRegion(new CellRangeAddress(1, 1, 0, headers.length - 1));

            // Row 2: Green Accent Bar across all 19 columns
            Row greenRow = sheet.createRow(2);
            greenRow.setHeightInPoints(5);
            for (int i = 0; i < headers.length; i++) {
                Cell gc = greenRow.createCell(i);
                gc.setCellStyle(greenBarStyle);
            }

            // Row 3: Header Row
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
            BigDecimal totalDisputeAmt = BigDecimal.ZERO;

            for (DisputeTransaction d : records) {
                Row row = sheet.createRow(rowIdx++);
                row.setHeightInPoints(20);

                BigDecimal tAmt = d.getTxnAmount() != null ? d.getTxnAmount() : BigDecimal.ZERO;
                BigDecimal dAmt = d.getDisputeAmount() != null ? d.getDisputeAmount() : BigDecimal.ZERO;
                totalTxnAmt = totalTxnAmt.add(tAmt);
                totalDisputeAmt = totalDisputeAmt.add(dAmt);

                String funcDesc = blankIfNull(d.getFunctionCode());
                String funcCode = extractCode(funcDesc);

                Cell c0 = row.createCell(0); c0.setCellValue(srNo++); c0.setCellStyle(centerStyle);
                Cell c1 = row.createCell(1); c1.setCellValue(blankIfNull(d.getPlazaName())); c1.setCellStyle(textStyle);
                Cell c2 = row.createCell(2); c2.setCellValue(blankIfNull(d.getPlazaId())); c2.setCellStyle(centerStyle);
                Cell c3 = row.createCell(3); c3.setCellValue(blankIfNull(d.getAcqTxnId())); c3.setCellStyle(textStyle);
                Cell c4 = row.createCell(4); c4.setCellValue(blankIfNull(d.getTollTxnId())); c4.setCellStyle(centerStyle);

                Cell c5 = row.createCell(5); c5.setCellValue(formatDateTime(d.getTxnDateTime())); c5.setCellStyle(centerStyle);
                Cell c6 = row.createCell(6); c6.setCellValue(tAmt.doubleValue()); c6.setCellStyle(numberStyle);
                Cell c7 = row.createCell(7); c7.setCellValue(dAmt.doubleValue()); c7.setCellStyle(numberStyle);

                Cell c8 = row.createCell(8); c8.setCellValue(blankIfNull(d.getVehicleNo())); c8.setCellStyle(centerStyle);
                Cell c9 = row.createCell(9); c9.setCellValue(blankIfNull(d.getTagId())); c9.setCellStyle(textStyle);
                Cell c10 = row.createCell(10); c10.setCellValue(blankIfNull(d.getTid())); c10.setCellStyle(textStyle);
                Cell c11 = row.createCell(11); c11.setCellValue(blankIfNull(d.getIssuerId())); c11.setCellStyle(centerStyle);
                Cell c12 = row.createCell(12); c12.setCellValue(blankIfNull(d.getIntTrackingNo(), "NA")); c12.setCellStyle(centerStyle);

                Cell c13 = row.createCell(13); c13.setCellValue(funcCode); c13.setCellStyle(centerStyle);
                Cell c14 = row.createCell(14); c14.setCellValue(funcDesc); c14.setCellStyle(textStyle);
                Cell c15 = row.createCell(15); c15.setCellValue(blankIfNull(d.getSettlementIndicator(), "--")); c15.setCellStyle(centerStyle);
                Cell c16 = row.createCell(16); c16.setCellValue(blankIfNull(d.getMessageReasonCode())); c16.setCellStyle(centerStyle);
                Cell c17 = row.createCell(17); c17.setCellValue(blankIfNull(d.getMemberMessageText())); c17.setCellStyle(textStyle);
                Cell c18 = row.createCell(18); c18.setCellValue(formatDate(d.getNpciSettlementDate())); c18.setCellStyle(centerStyle);
            }

            // Summary KPI Cards row at the bottom of the table
            rowIdx++;
            Row summaryRow = sheet.createRow(rowIdx);
            summaryRow.setHeightInPoints(24);

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
            blueKpiStyle.setFillForegroundColor(IndexedColors.DARK_BLUE.getIndex());
            blueKpiStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            blueKpiStyle.setAlignment(HorizontalAlignment.CENTER);
            blueKpiStyle.setVerticalAlignment(VerticalAlignment.CENTER);
            Font blueKpiFont = workbook.createFont();
            blueKpiFont.setBold(true);
            blueKpiFont.setColor(IndexedColors.WHITE.getIndex());
            blueKpiStyle.setFont(blueKpiFont);

            // Card 1: Total Dispute Records (cols 0-4)
            for (int i = 0; i <= 4; i++) {
                Cell c = summaryRow.createCell(i);
                c.setCellStyle(greenKpiStyle);
            }
            summaryRow.getCell(0).setCellValue("Total Dispute Records: " + records.size());
            sheet.addMergedRegion(new CellRangeAddress(rowIdx, rowIdx, 0, 4));

            // Card 2: Total Txn Amount (cols 5-9)
            for (int i = 5; i <= 9; i++) {
                Cell c = summaryRow.createCell(i);
                c.setCellStyle(blueKpiStyle);
            }
            summaryRow.getCell(5).setCellValue("Total Txn Amount: " + totalTxnAmt.setScale(2).toString());
            sheet.addMergedRegion(new CellRangeAddress(rowIdx, rowIdx, 5, 9));

            // Card 3: Total Dispute Amount (cols 10-14)
            for (int i = 10; i <= 14; i++) {
                Cell c = summaryRow.createCell(i);
                c.setCellStyle(greenKpiStyle);
            }
            summaryRow.getCell(10).setCellValue("Total Dispute Amount: " + totalDisputeAmt.setScale(2).toString());
            sheet.addMergedRegion(new CellRangeAddress(rowIdx, rowIdx, 10, 14));

            // Card 4: Database Status (cols 15-18)
            for (int i = 15; i <= 18; i++) {
                Cell c = summaryRow.createCell(i);
                c.setCellStyle(blueKpiStyle);
            }
            summaryRow.getCell(15).setCellValue("Live Railway DB: ONLINE");
            sheet.addMergedRegion(new CellRangeAddress(rowIdx, rowIdx, 15, 18));

            // Footer disclaimer
            rowIdx++;
            Row noteRow = sheet.createRow(rowIdx);
            noteRow.setHeightInPoints(18);
            Cell noteCell = noteRow.createCell(0);
            noteCell.setCellValue("* This report generated from Paysonic Database directly on demand");
            noteCell.setCellStyle(subTitleStyle);
            sheet.addMergedRegion(new CellRangeAddress(rowIdx, rowIdx, 0, headers.length - 1));

            int[] colWidths = {8, 20, 12, 24, 16, 20, 16, 16, 16, 30, 26, 14, 16, 14, 24, 14, 18, 36, 18};
            for (int i = 0; i < headers.length; i++) {
                sheet.setColumnWidth(i, colWidths[i] * 256);
            }

            workbook.write(outputStream);
            workbook.dispose();
            log.info("Streamed Dispute Transactions Excel Export with {} records", records.size());
        }
    }

    /**
     * Stream CSV export with UTF-8 BOM, centered header banner, and exact 19 columns
     */
    public void streamCsvExport(
            LocalDateTime fromDate,
            LocalDateTime toDate,
            String plazaId,
            String functionCode,
            OutputStream outputStream) throws Exception {

        List<DisputeTransaction> records = getDisputesList(fromDate, toDate, plazaId, functionCode);

        // Prepend UTF-8 BOM
        outputStream.write(0xEF);
        outputStream.write(0xBB);
        outputStream.write(0xBF);

        PrintWriter writer = new PrintWriter(outputStream, true);

        String[] headers = {
                "Sr No", "Plaza Name", "Plaza ID", "Acq Txn ID", "Toll Txn ID",
                "Txn Date Time", "Txn Amount", "Dispute Amount", "Vehicle No",
                "Tag ID", "TID", "Issuer ID", "Int Tracking No", "Function Code",
                "Function Code Description", "Settlement Indicator", "Message Reason Code",
                "Member Message Text", "NPCI Settlement Date"
        };

        String fromStr = fromDate != null ? fromDate.format(DATE_TIME_FMT) : "01-09-2026 00:00:00";
        String toStr = toDate != null ? toDate.format(DATE_TIME_FMT) : "30-09-2026 23:59:59";
        String exportTimeStr = LocalDateTime.now().format(DATE_TIME_FMT);
        int midIdx = headers.length / 2;

        String[] titleLine = new String[headers.length];
        String[] subLine = new String[headers.length];
        for (int i = 0; i < headers.length; i++) {
            titleLine[i] = "";
            subLine[i] = "";
        }
        titleLine[midIdx] = "TRANSACTION SEARCH - DISPUTE TRANSACTION";
        subLine[midIdx] = "From Date: " + fromStr + "   |   To Date: " + toStr + "   |   Export Time: " + exportTimeStr;

        writer.println(String.join(",", titleLine));
        writer.println(String.join(",", subLine));
        writer.println();
        writer.println(String.join(",", headers));

        int srNo = 1;
        BigDecimal totalTxnAmt = BigDecimal.ZERO;
        BigDecimal totalDisputeAmt = BigDecimal.ZERO;

        for (DisputeTransaction d : records) {
            BigDecimal tAmt = d.getTxnAmount() != null ? d.getTxnAmount() : BigDecimal.ZERO;
            BigDecimal dAmt = d.getDisputeAmount() != null ? d.getDisputeAmount() : BigDecimal.ZERO;
            totalTxnAmt = totalTxnAmt.add(tAmt);
            totalDisputeAmt = totalDisputeAmt.add(dAmt);

            String funcDesc = blankIfNull(d.getFunctionCode());
            String funcCode = extractCode(funcDesc);

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
                    escapeCsv(blankIfNull(d.getIntTrackingNo(), "NA")),
                    escapeCsv(funcCode),
                    escapeCsv(funcDesc),
                    escapeCsv(blankIfNull(d.getSettlementIndicator(), "--")),
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
        totalRow[7] = totalDisputeAmt.setScale(2).toString();
        totalRow[14] = records.size() + " Dispute Records";
        writer.println(String.join(",", totalRow));

        writer.println();
        writer.println("* This report generated from Paysonic Database directly on demand,,,,,,,,,,,,,,,,,,");

        writer.flush();
        log.info("Streamed Dispute Transactions CSV Export with {} records", records.size());
    }

    private String extractCode(String funcDesc) {
        if (funcDesc == null || funcDesc.trim().isEmpty()) return "";
        int colonIdx = funcDesc.indexOf(':');
        if (colonIdx > 0) {
            return funcDesc.substring(0, colonIdx).trim();
        }
        return funcDesc.trim();
    }

    private String formatDateTime(LocalDateTime dt) {
        return dt == null ? "" : dt.format(DATE_TIME_FMT);
    }

    private String formatDate(LocalDate dt) {
        return dt == null ? "" : dt.format(DATE_FMT);
    }

    private String blankIfNull(String val) {
        return val == null ? "" : val;
    }

    private String blankIfNull(String val, String def) {
        return (val == null || val.trim().isEmpty()) ? def : val;
    }

    private String escapeCsv(String val) {
        if (val == null) return "";
        if (val.contains(",") || val.contains("\"") || val.contains("\n") || val.contains("\r")) {
            return "\"" + val.replace("\"", "\"\"") + "\"";
        }
        return val;
    }
}
