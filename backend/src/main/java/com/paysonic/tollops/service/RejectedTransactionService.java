package com.paysonic.tollops.service;

import com.paysonic.tollops.entity.TollTransaction;
import com.paysonic.tollops.repository.TollTransactionRepository;
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
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

@Service
public class RejectedTransactionService {

    private static final Logger log = LoggerFactory.getLogger(RejectedTransactionService.class);
    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("dd-MM-yyyy HH:mm:ss");

    private final TollTransactionRepository repository;

    public RejectedTransactionService(TollTransactionRepository repository) {
        this.repository = repository;
    }

    public Page<TollTransaction> searchRejectedTransactions(
            LocalDateTime fromDate,
            LocalDateTime toDate,
            String plazaId,
            String reason,
            Pageable pageable) {

        Specification<TollTransaction> spec = buildRejectedSpecification(fromDate, toDate, plazaId, reason);
        return repository.findAll(spec, pageable);
    }

    public List<TollTransaction> getAllRejectedTransactions(
            LocalDateTime fromDate,
            LocalDateTime toDate,
            String plazaId,
            String reason) {

        Specification<TollTransaction> spec = buildRejectedSpecification(fromDate, toDate, plazaId, reason);
        return repository.findAll(spec);
    }

    private Specification<TollTransaction> buildRejectedSpecification(
            LocalDateTime fromDate,
            LocalDateTime toDate,
            String plazaId,
            String reason) {

        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            // 1. Date range filter
            if (fromDate != null && toDate != null) {
                predicates.add(cb.between(root.get("txnDate"), fromDate, toDate));
            } else if (fromDate != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("txnDate"), fromDate));
            } else if (toDate != null) {
                predicates.add(cb.lessThanOrEqualTo(root.get("txnDate"), toDate));
            }

            // 2. Plaza filter
            if (plazaId != null && !plazaId.trim().isEmpty() && !plazaId.equalsIgnoreCase("ALL")) {
                predicates.add(cb.equal(root.get("plazaId"), plazaId.trim()));
            }

            // 3. Reason filter
            if (reason != null && !reason.trim().isEmpty() && !reason.equalsIgnoreCase("ALL")) {
                predicates.add(cb.equal(root.get("reason"), reason.trim()));
            }

            // 4. Status strictly Rejected, Declined, or Failed
            Predicate isRejected = cb.equal(cb.lower(root.get("status")), "rejected");
            Predicate isDeclined = cb.equal(cb.lower(root.get("status")), "declined");
            Predicate isFailed = cb.equal(cb.lower(root.get("status")), "failed");
            predicates.add(cb.or(isRejected, isDeclined, isFailed));

            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }

    /**
     * Stream Excel (.xlsx) export with Royal Blue theme, centered banner, and bottom KPI cards
     */
    public void streamExcelExport(
            LocalDateTime fromDate,
            LocalDateTime toDate,
            String plazaId,
            String reason,
            OutputStream outputStream) throws Exception {

        List<TollTransaction> records = getAllRejectedTransactions(fromDate, toDate, plazaId, reason);

        try (SXSSFWorkbook workbook = new SXSSFWorkbook(100)) {
            Sheet sheet = workbook.createSheet("Rejected Transactions");
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

            // Status Badge Style (Soft Red fill, Dark Red bold text)
            CellStyle rejectedStyle = workbook.createCellStyle();
            rejectedStyle.setFillForegroundColor(IndexedColors.ROSE.getIndex());
            rejectedStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            rejectedStyle.setAlignment(HorizontalAlignment.CENTER);
            rejectedStyle.setVerticalAlignment(VerticalAlignment.CENTER);
            rejectedStyle.setBorderBottom(BorderStyle.THIN);
            rejectedStyle.setBorderTop(BorderStyle.THIN);
            rejectedStyle.setBorderLeft(BorderStyle.THIN);
            rejectedStyle.setBorderRight(BorderStyle.THIN);
            Font rejFont = workbook.createFont();
            rejFont.setBold(true);
            rejFont.setColor(IndexedColors.DARK_RED.getIndex());
            rejectedStyle.setFont(rejFont);

            String[] headers = {
                    "Sr No", "Toll File Name", "Plaza ID", "Plaza Name", "Lane ID",
                    "Tag ID", "VRN", "Acq Txn ID", "Toll Txn ID", "Toll Message ID",
                    "MVC", "Tag VC", "AVC", "Transaction Status", "Reason",
                    "Transaction Amount", "Transaction Date", "Plaza Posted Date",
                    "NPCI Error Code", "NPCI Response Date", "Transaction Type",
                    "Issuer Bank ID", "Issuer Bank Name", "TID", "Plaza Type", "Is Manual"
            };

            // Row 0: Title Banner
            Row titleRow = sheet.createRow(0);
            titleRow.setHeightInPoints(28);
            Cell titleCell = titleRow.createCell(0);
            titleCell.setCellValue("REJECTED TRANSACTIONS REPORT");
            titleCell.setCellStyle(titleStyle);
            sheet.addMergedRegion(new CellRangeAddress(0, 0, 0, headers.length - 1));

            // Row 1: Subtitle with Date Range
            Row subRow = sheet.createRow(1);
            subRow.setHeightInPoints(18);
            Cell subCell = subRow.createCell(0);
            String fromStr = fromDate != null ? fromDate.format(DATE_FMT) : "01-09-2026 00:00:00";
            String toStr = toDate != null ? toDate.format(DATE_FMT) : "06-09-2026 23:59:59";
            String fetchTimeStr = LocalDateTime.now().format(DATE_FMT);
            subCell.setCellValue("From Date: " + fromStr + "   |   To Date: " + toStr + "   |   Export Time: " + fetchTimeStr);
            subCell.setCellStyle(subTitleStyle);
            sheet.addMergedRegion(new CellRangeAddress(1, 1, 0, headers.length - 1));

            // Row 2: Green Accent Bar across all 26 columns
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
            BigDecimal totalRejectedAmt = BigDecimal.ZERO;
            long duplicateCount = 0;

            for (TollTransaction t : records) {
                Row row = sheet.createRow(rowIdx++);
                row.setHeightInPoints(20);

                BigDecimal amt = t.getTxnAmount() != null ? t.getTxnAmount() : BigDecimal.ZERO;
                totalRejectedAmt = totalRejectedAmt.add(amt);
                if ("DUPLICATE".equalsIgnoreCase(t.getReason())) {
                    duplicateCount++;
                }

                String issuerBankId = "052337";
                if ("Autumn".equalsIgnoreCase(t.getPlazaName()) || "Gluten".equalsIgnoreCase(t.getPlazaName()) || "778999".equals(t.getPlazaId())) {
                    issuerBankId = "007030";
                }

                Cell c0 = row.createCell(0); c0.setCellValue(srNo++); c0.setCellStyle(centerStyle);
                Cell c1 = row.createCell(1); c1.setCellValue(blankIfNull(t.getTollFileName(), "ONLINE")); c1.setCellStyle(centerStyle);
                Cell c2 = row.createCell(2); c2.setCellValue(blankIfNull(t.getPlazaId())); c2.setCellStyle(centerStyle);
                Cell c3 = row.createCell(3); c3.setCellValue(blankIfNull(t.getPlazaName())); c3.setCellStyle(textStyle);
                Cell c4 = row.createCell(4); c4.setCellValue(blankIfNull(t.getLaneId())); c4.setCellStyle(centerStyle);
                Cell c5 = row.createCell(5); c5.setCellValue(blankIfNull(t.getTagId())); c5.setCellStyle(textStyle);
                Cell c6 = row.createCell(6); c6.setCellValue(blankIfNull(t.getVrn())); c6.setCellStyle(centerStyle);

                Cell c7 = row.createCell(7); c7.setCellValue(blankIfNull(t.getAcqTxnId())); c7.setCellStyle(textStyle);
                Cell c8 = row.createCell(8); c8.setCellValue(blankIfNull(t.getTollTxnId())); c8.setCellStyle(centerStyle);
                Cell c9 = row.createCell(9); c9.setCellValue(blankIfNull(t.getTollMessageId())); c9.setCellStyle(centerStyle);
                Cell c10 = row.createCell(10); c10.setCellValue(blankIfNull(t.getMvc())); c10.setCellStyle(centerStyle);
                Cell c11 = row.createCell(11); c11.setCellValue(blankIfNull(t.getTagVc(), "4")); c11.setCellStyle(centerStyle);
                Cell c12 = row.createCell(12); c12.setCellValue(blankIfNull(t.getAvc())); c12.setCellStyle(centerStyle);

                // 13. Transaction Status
                Cell c13 = row.createCell(13);
                c13.setCellValue(blankIfNull(t.getStatus(), "Rejected"));
                c13.setCellStyle(rejectedStyle);

                // 14. Reason
                Cell c14 = row.createCell(14);
                c14.setCellValue(blankIfNull(t.getReason(), "DUPLICATE"));
                c14.setCellStyle(centerStyle);

                // 15. Transaction Amount
                Cell c15 = row.createCell(15);
                c15.setCellValue(amt.doubleValue());
                c15.setCellStyle(numberStyle);

                // 16. Transaction Date
                Cell c16 = row.createCell(16); c16.setCellValue(formatDate(t.getTxnDate())); c16.setCellStyle(centerStyle);

                // 17. Plaza Posted Date
                Cell c17 = row.createCell(17); c17.setCellValue(formatDate(t.getPlazaPostDate())); c17.setCellStyle(centerStyle);

                // 18. NPCI Error Code
                Cell c18 = row.createCell(18); c18.setCellValue(blankIfNull(t.getNpciErrorCode())); c18.setCellStyle(centerStyle);

                // 19. NPCI Response Date
                Cell c19 = row.createCell(19); c19.setCellValue(formatDate(t.getNpciRespDate())); c19.setCellStyle(centerStyle);

                // 20. Transaction Type
                Cell c20 = row.createCell(20); c20.setCellValue(blankIfNull(t.getTxnType(), "DEBIT")); c20.setCellStyle(centerStyle);

                // 21. Issuer Bank ID
                Cell c21 = row.createCell(21); c21.setCellValue(issuerBankId); c21.setCellStyle(centerStyle);

                // 22. Issuer Bank Name
                Cell c22 = row.createCell(22); c22.setCellValue(""); c22.setCellStyle(centerStyle);

                // 23. TID
                Cell c23 = row.createCell(23); c23.setCellValue(blankIfNull(t.getTagId())); c23.setCellStyle(textStyle);

                // 24. Plaza Type
                Cell c24 = row.createCell(24); c24.setCellValue(blankIfNull(t.getPlazaType(), "Toll")); c24.setCellStyle(centerStyle);

                // 25. Is Manual
                Cell c25 = row.createCell(25); c25.setCellValue("NA"); c25.setCellStyle(centerStyle);
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

            // Card 1: Total Rejected Count (cols 0-5)
            for (int i = 0; i <= 5; i++) {
                Cell c = summaryRow.createCell(i);
                c.setCellStyle(greenKpiStyle);
            }
            summaryRow.getCell(0).setCellValue("Total Rejected Transactions: " + records.size());
            sheet.addMergedRegion(new CellRangeAddress(rowIdx, rowIdx, 0, 5));

            // Card 2: Total Rejected Amount (cols 6-12)
            for (int i = 6; i <= 12; i++) {
                Cell c = summaryRow.createCell(i);
                c.setCellStyle(blueKpiStyle);
            }
            summaryRow.getCell(6).setCellValue("Total Rejected Amount: " + totalRejectedAmt.setScale(2).toString());
            sheet.addMergedRegion(new CellRangeAddress(rowIdx, rowIdx, 6, 12));

            // Card 3: Duplicate Rejections (cols 13-18)
            for (int i = 13; i <= 18; i++) {
                Cell c = summaryRow.createCell(i);
                c.setCellStyle(greenKpiStyle);
            }
            summaryRow.getCell(13).setCellValue("Duplicate Rejections: " + duplicateCount);
            sheet.addMergedRegion(new CellRangeAddress(rowIdx, rowIdx, 13, 18));

            // Card 4: Other Reason Rejections (cols 19-25)
            for (int i = 19; i <= 25; i++) {
                Cell c = summaryRow.createCell(i);
                c.setCellStyle(blueKpiStyle);
            }
            summaryRow.getCell(19).setCellValue("Validation / Tag Rejections: " + (records.size() - duplicateCount));
            sheet.addMergedRegion(new CellRangeAddress(rowIdx, rowIdx, 19, 25));

            // Footer disclaimer
            rowIdx++;
            Row noteRow = sheet.createRow(rowIdx);
            noteRow.setHeightInPoints(18);
            Cell noteCell = noteRow.createCell(0);
            noteCell.setCellValue("* This report generated from Paysonic Database directly on demand");
            noteCell.setCellStyle(subTitleStyle);
            sheet.addMergedRegion(new CellRangeAddress(rowIdx, rowIdx, 0, headers.length - 1));

            int[] colWidths = {8, 14, 12, 24, 10, 30, 16, 24, 16, 16, 10, 10, 10, 18, 16, 18, 20, 20, 16, 20, 16, 16, 18, 30, 14, 12};
            for (int i = 0; i < headers.length; i++) {
                sheet.setColumnWidth(i, colWidths[i] * 256);
            }

            workbook.write(outputStream);
            workbook.dispose();
            log.info("Streamed Rejected Transactions Excel Export with {} records", records.size());
        }
    }

    /**
     * Stream CSV export with UTF-8 BOM, centered header banner, and exact 26 columns
     */
    public void streamCsvExport(
            LocalDateTime fromDate,
            LocalDateTime toDate,
            String plazaId,
            String reason,
            OutputStream outputStream) throws Exception {

        List<TollTransaction> records = getAllRejectedTransactions(fromDate, toDate, plazaId, reason);

        // Prepend UTF-8 BOM
        outputStream.write(0xEF);
        outputStream.write(0xBB);
        outputStream.write(0xBF);

        PrintWriter writer = new PrintWriter(outputStream, true);

        String[] headers = {
                "Sr No", "Toll File Name", "Plaza ID", "Plaza Name", "Lane ID",
                "Tag ID", "VRN", "Acq Txn ID", "Toll Txn ID", "Toll Message ID",
                "MVC", "Tag VC", "AVC", "Transaction Status", "Reason",
                "Transaction Amount", "Transaction Date", "Plaza Posted Date",
                "NPCI Error Code", "NPCI Response Date", "Transaction Type",
                "Issuer Bank ID", "Issuer Bank Name", "TID", "Plaza Type", "Is Manual"
        };

        String fromStr = fromDate != null ? fromDate.format(DATE_FMT) : "01-09-2026 00:00:00";
        String toStr = toDate != null ? toDate.format(DATE_FMT) : "06-09-2026 23:59:59";
        String fetchTimeStr = LocalDateTime.now().format(DATE_FMT);
        int midIdx = headers.length / 2;

        String[] titleLine = new String[headers.length];
        String[] subLine = new String[headers.length];
        for (int i = 0; i < headers.length; i++) {
            titleLine[i] = "";
            subLine[i] = "";
        }
        titleLine[midIdx] = "REJECTED TRANSACTIONS REPORT";
        subLine[midIdx] = "From Date: " + fromStr + "   |   To Date: " + toStr + "   |   Export Time: " + fetchTimeStr;

        writer.println(String.join(",", titleLine));
        writer.println(String.join(",", subLine));
        writer.println();
        writer.println(String.join(",", headers));

        int srNo = 1;
        BigDecimal totalRejectedAmt = BigDecimal.ZERO;
        long duplicateCount = 0;

        for (TollTransaction t : records) {
            BigDecimal amt = t.getTxnAmount() != null ? t.getTxnAmount() : BigDecimal.ZERO;
            totalRejectedAmt = totalRejectedAmt.add(amt);
            if ("DUPLICATE".equalsIgnoreCase(t.getReason())) {
                duplicateCount++;
            }

            String issuerBankId = "052337";
            if ("Autumn".equalsIgnoreCase(t.getPlazaName()) || "Gluten".equalsIgnoreCase(t.getPlazaName()) || "778999".equals(t.getPlazaId())) {
                issuerBankId = "007030";
            }

            String[] row = {
                    String.valueOf(srNo++),
                    escapeCsv(blankIfNull(t.getTollFileName(), "ONLINE")),
                    escapeCsv(t.getPlazaId()),
                    escapeCsv(t.getPlazaName()),
                    escapeCsv(t.getLaneId()),
                    escapeCsv(t.getTagId()),
                    escapeCsv(t.getVrn()),
                    escapeCsv(t.getAcqTxnId()),
                    escapeCsv(t.getTollTxnId()),
                    escapeCsv(t.getTollMessageId()),
                    escapeCsv(t.getMvc()),
                    escapeCsv(blankIfNull(t.getTagVc(), "4")),
                    escapeCsv(t.getAvc()),
                    escapeCsv(blankIfNull(t.getStatus(), "Rejected")),
                    escapeCsv(blankIfNull(t.getReason(), "DUPLICATE")),
                    amt.setScale(2).toString(),
                    escapeCsv(formatDate(t.getTxnDate())),
                    escapeCsv(formatDate(t.getPlazaPostDate())),
                    escapeCsv(blankIfNull(t.getNpciErrorCode())),
                    escapeCsv(formatDate(t.getNpciRespDate())),
                    escapeCsv(blankIfNull(t.getTxnType(), "DEBIT")),
                    escapeCsv(issuerBankId),
                    "",
                    escapeCsv(t.getTagId()),
                    escapeCsv(blankIfNull(t.getPlazaType(), "Toll")),
                    "NA"
            };
            writer.println(String.join(",", row));
        }

        // Summary Total Row
        String[] totalRow = new String[headers.length];
        for (int i = 0; i < headers.length; i++) totalRow[i] = "";
        totalRow[0] = "TOTAL";
        totalRow[13] = records.size() + " Rejected (Duplicates: " + duplicateCount + ")";
        totalRow[15] = totalRejectedAmt.setScale(2).toString();
        writer.println(String.join(",", totalRow));

        writer.println();
        writer.println("* This report generated from Paysonic Database directly on demand,,,,,,,,,,,,,,,,,,,,,,,,,");

        writer.flush();
        log.info("Streamed Rejected Transactions CSV Export with {} records", records.size());
    }

    private String formatDate(LocalDateTime dt) {
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
