package com.paysonic.tollops.service;

import com.paysonic.tollops.entity.TollTransaction;
import com.paysonic.tollops.repository.TollTransactionRepository;
import jakarta.persistence.criteria.Predicate;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.streaming.SXSSFWorkbook;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;

import java.io.OutputStream;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

@Service
public class TrsReportService {

    private static final Logger log = LoggerFactory.getLogger(TrsReportService.class);
    private final TollTransactionRepository repository;

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("dd-MM-yyyy HH:mm:ss");

    public TrsReportService(TollTransactionRepository repository) {
        this.repository = repository;
    }

    public Page<TollTransaction> searchTransactions(
            LocalDateTime fromDate,
            LocalDateTime toDate,
            String plazaId,
            String status,
            Pageable pageable) {

        Specification<TollTransaction> spec = buildSpecification(fromDate, toDate, plazaId, status);
        return repository.findAll(spec, pageable);
    }

    public List<TollTransaction> getTransactionsList(
            LocalDateTime fromDate,
            LocalDateTime toDate,
            String plazaId,
            String status) {

        Specification<TollTransaction> spec = buildSpecification(fromDate, toDate, plazaId, status);
        return repository.findAll(spec);
    }

    public void streamExcelExport(
            LocalDateTime fromDate,
            LocalDateTime toDate,
            String plazaId,
            String status,
            OutputStream outputStream) throws Exception {

        Specification<TollTransaction> spec = buildSpecification(fromDate, toDate, plazaId, status);
        List<TollTransaction> records = repository.findAll(spec);

        try (SXSSFWorkbook workbook = new SXSSFWorkbook(100)) {
            Sheet sheet = workbook.createSheet("TRS Report");
            DataFormat dataFormat = workbook.createDataFormat();

            // 1. Title Style (Bold Royal Blue, 16pt)
            CellStyle titleStyle = workbook.createCellStyle();
            Font titleFont = workbook.createFont();
            titleFont.setFontName("Calibri");
            titleFont.setFontHeightInPoints((short) 16);
            titleFont.setBold(true);
            titleFont.setColor(IndexedColors.DARK_BLUE.getIndex());
            titleStyle.setFont(titleFont);
            titleStyle.setVerticalAlignment(VerticalAlignment.CENTER);

            // 2. Subtitle Date Range Style (Muted Grey, 10pt)
            CellStyle subTitleStyle = workbook.createCellStyle();
            Font subFont = workbook.createFont();
            subFont.setFontName("Calibri");
            subFont.setFontHeightInPoints((short) 10);
            subFont.setColor(IndexedColors.GREY_50_PERCENT.getIndex());
            subTitleStyle.setFont(subFont);
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

            // 5. Data Cell Styles (with thin borders)
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

            // 6. Status Badges (Image 2 exact colors)
            // Declined: soft red background (#FFE2E2 -> ROSE), dark red text, bold
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

            // Accepted / Settled: soft green background (#DCFCE7 -> LIGHT_GREEN), dark green text, bold
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
                "Sr No", "Toll File Name", "Plaza ID", "Plaza Name", "Lane ID",
                "Tag ID", "VRN", "Acq Txn ID", "Toll Txn ID", "Toll Message ID",
                "MVC", "Tag VC", "AVC", "Transaction Status", "Reason",
                "Transaction Amount", "Settled Amount", "Transaction Date", "Plaza Post Date",
                "NPCI Error Code", "NPCI Settled Date", "NPCI Clearing Cycle", "Plaza Settlement Date",
                "Transaction Type", "NPCI Response Date", "Plaza Type", "Is Violation",
                "Audit VC", "Violation Settlement Amount", "Violation Settlement Date"
            };

            // Row 0: Title Banner
            Row titleRow = sheet.createRow(0);
            titleRow.setHeightInPoints(28);
            Cell titleCell = titleRow.createCell(0);
            titleCell.setCellValue("TRANSACTION REPORT");
            titleCell.setCellStyle(titleStyle);

            // Row 1: Subtitle with Date Range
            Row subRow = sheet.createRow(1);
            subRow.setHeightInPoints(18);
            Cell subCell = subRow.createCell(0);
            String fromStr = fromDate != null ? fromDate.format(DATE_FMT) : "01-09-2026 00:00:00";
            String toStr = toDate != null ? toDate.format(DATE_FMT) : "30-09-2026 23:59:59";
            subCell.setCellValue("From Date: " + fromStr + "  |  To Date: " + toStr);
            subCell.setCellStyle(subTitleStyle);

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
            for (TollTransaction t : records) {
                Row row = sheet.createRow(rowIdx);
                row.setHeightInPoints(20);

                Cell c0 = row.createCell(0); c0.setCellValue(srNo++); c0.setCellStyle(centerStyle);
                Cell c1 = row.createCell(1); c1.setCellValue(blankIfNull(t.getTollFileName())); c1.setCellStyle(centerStyle);
                Cell c2 = row.createCell(2); c2.setCellValue(blankIfNull(t.getPlazaId())); c2.setCellStyle(centerStyle);
                Cell c3 = row.createCell(3); c3.setCellValue(blankIfNull(t.getPlazaName())); c3.setCellStyle(textStyle);
                Cell c4 = row.createCell(4); c4.setCellValue(blankIfNull(t.getLaneId())); c4.setCellStyle(centerStyle);
                Cell c5 = row.createCell(5); c5.setCellValue(blankIfNull(t.getTagId())); c5.setCellStyle(textStyle);
                Cell c6 = row.createCell(6); c6.setCellValue(blankIfNull(t.getVrn())); c6.setCellStyle(centerStyle);

                // Acq Txn ID: MUST BE TEXT
                Cell acqCell = row.createCell(7);
                acqCell.setCellStyle(textStyle);
                acqCell.setCellValue(blankIfNull(t.getAcqTxnId()));

                Cell c8 = row.createCell(8); c8.setCellValue(blankIfNull(t.getTollTxnId())); c8.setCellStyle(centerStyle);
                Cell c9 = row.createCell(9); c9.setCellValue(blankIfNull(t.getTollMessageId())); c9.setCellStyle(centerStyle);
                Cell c10 = row.createCell(10); c10.setCellValue(blankIfNull(t.getMvc())); c10.setCellStyle(centerStyle);
                Cell c11 = row.createCell(11); c11.setCellValue(blankIfNull(t.getTagVc())); c11.setCellStyle(centerStyle);
                Cell c12 = row.createCell(12); c12.setCellValue(blankIfNull(t.getAvc())); c12.setCellStyle(centerStyle);

                // Transaction Status (Declined / Accepted)
                Cell statusCell = row.createCell(13);
                String st = blankIfNull(t.getStatus());
                statusCell.setCellValue(st);
                if (st.equalsIgnoreCase("Declined") || st.equalsIgnoreCase("Failed") || st.equalsIgnoreCase("Rejected")) {
                    statusCell.setCellStyle(declinedStyle);
                } else if (st.equalsIgnoreCase("Accepted") || st.equalsIgnoreCase("Settled") || st.equalsIgnoreCase("Success")) {
                    statusCell.setCellStyle(acceptedStyle);
                } else {
                    statusCell.setCellStyle(centerStyle);
                }

                Cell c14 = row.createCell(14); c14.setCellValue(blankIfNull(t.getReason())); c14.setCellStyle(textStyle);

                // Transaction Amount
                Cell txnAmtCell = row.createCell(15);
                txnAmtCell.setCellStyle(numberStyle);
                if (t.getTxnAmount() != null) {
                    txnAmtCell.setCellValue(t.getTxnAmount().doubleValue());
                } else {
                    txnAmtCell.setCellValue(0.0);
                }

                // Settled Amount (blank if rejected/null)
                Cell setAmtCell = row.createCell(16);
                setAmtCell.setCellStyle(numberStyle);
                if (t.getSettledAmount() != null) {
                    setAmtCell.setCellValue(t.getSettledAmount().doubleValue());
                } else {
                    setAmtCell.setCellValue(0.0);
                }

                Cell c17 = row.createCell(17); c17.setCellValue(formatDate(t.getTxnDate())); c17.setCellStyle(centerStyle);
                Cell c18 = row.createCell(18); c18.setCellValue(formatDate(t.getPlazaPostDate())); c18.setCellStyle(centerStyle);
                Cell c19 = row.createCell(19); c19.setCellValue(blankIfNull(t.getNpciErrorCode())); c19.setCellStyle(centerStyle);
                Cell c20 = row.createCell(20); c20.setCellValue(formatDate(t.getNpciSettledDate())); c20.setCellStyle(centerStyle);
                Cell c21 = row.createCell(21); c21.setCellValue(blankIfNull(t.getClearingCycle())); c21.setCellStyle(centerStyle);
                Cell c22 = row.createCell(22); c22.setCellValue(formatDate(t.getPlazaSettleDate())); c22.setCellStyle(centerStyle);
                Cell c23 = row.createCell(23); c23.setCellValue(blankIfNull(t.getTxnType())); c23.setCellStyle(centerStyle);
                Cell c24 = row.createCell(24); c24.setCellValue(formatDate(t.getNpciRespDate())); c24.setCellStyle(centerStyle);
                Cell c25 = row.createCell(25); c25.setCellValue(blankIfNull(t.getPlazaType())); c25.setCellStyle(centerStyle);
                Cell c26 = row.createCell(26); c26.setCellValue(blankIfNull(t.getIsViolation())); c26.setCellStyle(centerStyle);
                Cell c27 = row.createCell(27); c27.setCellValue(blankIfNull(t.getAuditVc())); c27.setCellStyle(centerStyle);

                // Violation Settled Amount
                Cell vAmtCell = row.createCell(28);
                vAmtCell.setCellStyle(numberStyle);
                if (t.getViolationSettledAmount() != null) {
                    vAmtCell.setCellValue(t.getViolationSettledAmount().doubleValue());
                } else {
                    vAmtCell.setCellValue(0.0);
                }

                Cell c29 = row.createCell(29); c29.setCellValue(formatDate(t.getViolationSettledDate())); c29.setCellStyle(centerStyle);
                rowIdx++;
            }

            int[] colWidths = {
                10, // Sr No
                18, // Toll File Name
                14, // Plaza ID
                26, // Plaza Name
                12, // Lane ID
                32, // Tag ID
                18, // VRN
                26, // Acq Txn ID
                18, // Toll Txn ID
                18, // Toll Message ID
                12, // MVC
                12, // Tag VC
                12, // AVC
                20, // Transaction Status
                22, // Reason
                20, // Transaction Amount
                20, // Settled Amount
                22, // Transaction Date
                22, // Plaza Post Date
                18, // NPCI Error Code
                22, // NPCI Settled Date
                20, // NPCI Clearing Cycle
                22, // Plaza Settlement Date
                18, // Transaction Type
                22, // NPCI Response Date
                16, // Plaza Type
                14, // Is Violation
                14, // Audit VC
                24, // Violation Settlement Amount
                24  // Violation Settlement Date
            };
            for (int i = 0; i < headers.length; i++) {
                int w = (i < colWidths.length) ? colWidths[i] : 18;
                sheet.setColumnWidth(i, w * 256);
            }

            workbook.write(outputStream);
            workbook.dispose();
            log.info("Streamed TRS Excel Export with {} records", records.size());
        }
    }

    private Specification<TollTransaction> buildSpecification(
            LocalDateTime fromDate,
            LocalDateTime toDate,
            String plazaId,
            String status) {

        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (fromDate != null && toDate != null) {
                predicates.add(cb.between(root.get("txnDate"), fromDate, toDate));
            } else if (fromDate != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("txnDate"), fromDate));
            } else if (toDate != null) {
                predicates.add(cb.lessThanOrEqualTo(root.get("txnDate"), toDate));
            }

            if (plazaId != null && !plazaId.trim().isEmpty() && !plazaId.equalsIgnoreCase("ALL")) {
                predicates.add(cb.equal(root.get("plazaId"), plazaId.trim()));
            }

            if (status != null && !status.trim().isEmpty() && !status.equalsIgnoreCase("ALL")) {
                predicates.add(cb.equal(root.get("status"), status.trim()));
            }

            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }

    private String formatDate(LocalDateTime dt) {
        return dt == null ? "" : dt.format(DATE_FMT);
    }

    private String blankIfNull(String val) {
        return val == null ? "" : val;
    }
}
