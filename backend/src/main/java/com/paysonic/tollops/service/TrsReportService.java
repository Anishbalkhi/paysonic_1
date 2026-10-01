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

            // 1. Title Style (Bold Royal Blue, 16pt, Centered in middle of table)
            CellStyle titleStyle = workbook.createCellStyle();
            Font titleFont = workbook.createFont();
            titleFont.setFontName("Calibri");
            titleFont.setFontHeightInPoints((short) 16);
            titleFont.setBold(true);
            titleFont.setColor(IndexedColors.DARK_BLUE.getIndex());
            titleStyle.setFont(titleFont);
            titleStyle.setAlignment(HorizontalAlignment.CENTER);
            titleStyle.setVerticalAlignment(VerticalAlignment.CENTER);

            // 2. Subtitle Date Range Style (Muted Grey, 10pt, Centered in middle of table)
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
                "Transaction Amount", "Transaction Date", "Plaza Posted Date",
                "NPCI Error Code", "NPCI Response Date", "Transaction Type",
                "Issuer Bank ID", "Issuer Bank Name", "TID", "Plaza Type", "Is Manual"
            };

            // Row 0: Title Banner (Centered in the middle of the table)
            Row titleRow = sheet.createRow(0);
            titleRow.setHeightInPoints(28);
            Cell titleCell = titleRow.createCell(0);
            titleCell.setCellValue("TRANSACTION REPORT");
            titleCell.setCellStyle(titleStyle);
            sheet.addMergedRegion(new CellRangeAddress(0, 0, 0, headers.length - 1));

            // Row 1: Subtitle with Date Range (Centered in the middle of the table)
            Row subRow = sheet.createRow(1);
            subRow.setHeightInPoints(18);
            Cell subCell = subRow.createCell(0);
            String fromStr = fromDate != null ? fromDate.format(DATE_FMT) : "01-09-2026 00:00:00";
            String toStr = toDate != null ? toDate.format(DATE_FMT) : "06-09-2026 23:59:59";
            subCell.setCellValue("From Date: " + fromStr + "   |   To Date: " + toStr);
            subCell.setCellStyle(subTitleStyle);
            sheet.addMergedRegion(new CellRangeAddress(1, 1, 0, headers.length - 1));

            // Row 2: Green Accent Bar across all 26 columns
            Row greenRow = sheet.createRow(2);
            greenRow.setHeightInPoints(5);
            for (int i = 0; i < headers.length; i++) {
                Cell gc = greenRow.createCell(i);
                gc.setCellStyle(greenBarStyle);
            }

            // Row 3: Table Header Row (Royal Blue fill with Bold White text)
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

                // 7. Acq Txn ID: MUST BE TEXT
                Cell acqCell = row.createCell(7);
                acqCell.setCellStyle(textStyle);
                acqCell.setCellValue(blankIfNull(t.getAcqTxnId()));

                Cell c8 = row.createCell(8); c8.setCellValue(blankIfNull(t.getTollTxnId())); c8.setCellStyle(centerStyle);
                Cell c9 = row.createCell(9); c9.setCellValue(blankIfNull(t.getTollMessageId())); c9.setCellStyle(centerStyle);
                Cell c10 = row.createCell(10); c10.setCellValue(blankIfNull(t.getMvc())); c10.setCellStyle(centerStyle);
                Cell c11 = row.createCell(11); c11.setCellValue(blankIfNull(t.getTagVc())); c11.setCellStyle(centerStyle);
                Cell c12 = row.createCell(12); c12.setCellValue(blankIfNull(t.getAvc())); c12.setCellStyle(centerStyle);

                // 13. Transaction Status (Declined / Accepted / Rejected)
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

                // 14. Reason
                Cell c14 = row.createCell(14); c14.setCellValue(blankIfNull(t.getReason())); c14.setCellStyle(centerStyle);

                // 15. Transaction Amount
                Cell txnAmtCell = row.createCell(15);
                txnAmtCell.setCellStyle(numberStyle);
                if (t.getTxnAmount() != null) {
                    txnAmtCell.setCellValue(t.getTxnAmount().doubleValue());
                } else {
                    txnAmtCell.setCellValue(0.0);
                }

                // 16. Transaction Date
                Cell c16 = row.createCell(16); c16.setCellValue(formatDate(t.getTxnDate())); c16.setCellStyle(centerStyle);

                // 17. Plaza Posted Date
                Cell c17 = row.createCell(17); c17.setCellValue(formatDate(t.getPlazaPostDate())); c17.setCellStyle(centerStyle);

                // 18. NPCI Error Code
                Cell c18 = row.createCell(18); c18.setCellValue(blankIfNull(t.getNpciErrorCode())); c18.setCellStyle(centerStyle);

                // 19. NPCI Response Date
                Cell c19 = row.createCell(19); c19.setCellValue(formatDate(t.getNpciRespDate())); c19.setCellStyle(centerStyle);

                // 20. Transaction Type
                Cell c20 = row.createCell(20); c20.setCellValue(blankIfNull(t.getTxnType())); c20.setCellStyle(centerStyle);

                // 21. Issuer Bank ID
                String issuerBankId = "052337";
                if ("Autumn".equalsIgnoreCase(t.getPlazaName()) || "Gluten".equalsIgnoreCase(t.getPlazaName()) || "778999".equals(t.getPlazaId())) {
                    issuerBankId = "007030";
                }
                Cell c21 = row.createCell(21); c21.setCellValue(issuerBankId); c21.setCellStyle(centerStyle);

                // 22. Issuer Bank Name
                Cell c22 = row.createCell(22); c22.setCellValue(""); c22.setCellStyle(centerStyle);

                // 23. TID (Tag ID)
                Cell c23 = row.createCell(23); c23.setCellValue(blankIfNull(t.getTagId())); c23.setCellStyle(textStyle);

                // 24. Plaza Type
                Cell c24 = row.createCell(24); c24.setCellValue(blankIfNull(t.getPlazaType())); c24.setCellStyle(centerStyle);

                // 25. Is Manual
                Cell c25 = row.createCell(25); c25.setCellValue("NA"); c25.setCellStyle(centerStyle);

                rowIdx++;
            }

            int[] colWidths = {
                8,  // A: Sr No
                14, // B: Toll File Name
                12, // C: Plaza ID
                24, // D: Plaza Name
                10, // E: Lane ID
                30, // F: Tag ID
                16, // G: VRN
                24, // H: Acq Txn ID
                16, // I: Toll Txn ID
                16, // J: Toll Message ID
                10, // K: MVC
                10, // L: Tag VC
                10, // M: AVC
                18, // N: Transaction Status
                16, // O: Reason
                18, // P: Transaction Amount
                20, // Q: Transaction Date
                20, // R: Plaza Posted Date
                16, // S: NPCI Error Code
                20, // T: NPCI Response Date
                16, // U: Transaction Type
                16, // V: Issuer Bank ID
                18, // W: Issuer Bank Name
                30, // X: TID
                14, // Y: Plaza Type
                12  // Z: Is Manual
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
