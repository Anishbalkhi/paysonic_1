package com.paysonic.tollops.service;

import com.paysonic.tollops.dto.DateWiseBreakdownDTO;
import com.paysonic.tollops.dto.DateWiseReconSummaryDTO;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.Query;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.streaming.SXSSFWorkbook;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.OutputStream;
import java.math.BigDecimal;
import java.sql.Date;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
public class DateWiseReconService {

    private static final Logger log = LoggerFactory.getLogger(DateWiseReconService.class);
    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("dd-MM-yyyy");

    @PersistenceContext
    private EntityManager entityManager;

    /**
     * Search and aggregate transactions into two-tier hierarchical Date Wise Recon summary
     */
    @SuppressWarnings("unchecked")
    public List<DateWiseReconSummaryDTO> searchDateWiseRecon(LocalDateTime fromDate, LocalDateTime toDate, String plazaId) {
        StringBuilder sql = new StringBuilder();
        sql.append("SELECT ")
           .append("  t.plaza_id, ")
           .append("  t.plaza_name, ")
           .append("  CAST(t.txn_date AS DATE) AS t_date, ")
           .append("  CAST(COALESCE(t.npci_settled_date, t.plaza_settle_date, t.txn_date) AS DATE) AS s_date, ")
           .append("  COUNT(*) AS cnt, ")
           .append("  SUM(COALESCE(t.settled_amount, t.txn_amount, 0)) AS amt ")
           .append("FROM toll_transactions t ")
           .append("WHERE t.status = 'Settled' ");

        if (fromDate != null) {
            sql.append("  AND t.txn_date >= :fromDate ");
        }
        if (toDate != null) {
            sql.append("  AND t.txn_date <= :toDate ");
        }
        if (plazaId != null && !plazaId.trim().isEmpty() && !plazaId.equalsIgnoreCase("ALL")) {
            sql.append("  AND (t.plaza_id = :plazaId OR LOWER(t.plaza_name) LIKE LOWER(:plazaSearch)) ");
        }

        sql.append("GROUP BY t.plaza_id, t.plaza_name, CAST(t.txn_date AS DATE), CAST(COALESCE(t.npci_settled_date, t.plaza_settle_date, t.txn_date) AS DATE) ")
           .append("ORDER BY t_date DESC, t.plaza_id ASC, s_date ASC");

        Query query = entityManager.createNativeQuery(sql.toString());
        if (fromDate != null) {
            query.setParameter("fromDate", fromDate);
        }
        if (toDate != null) {
            query.setParameter("toDate", toDate);
        }
        if (plazaId != null && !plazaId.trim().isEmpty() && !plazaId.equalsIgnoreCase("ALL")) {
            query.setParameter("plazaId", plazaId.trim());
            query.setParameter("plazaSearch", "%" + plazaId.trim() + "%");
        }

        List<Object[]> rawList = query.getResultList();
        Map<String, DateWiseReconSummaryDTO> summaryMap = new LinkedHashMap<>();

        for (Object[] row : rawList) {
            String pId = row[0] != null ? row[0].toString() : "";
            String pName = row[1] != null ? row[1].toString() : "";
            LocalDate tDate = parseLocalDate(row[2]);
            LocalDate sDate = parseLocalDate(row[3]);
            long cnt = ((Number) row[4]).longValue();
            BigDecimal amt = new BigDecimal(row[5].toString());

            String key = pId + "_" + (tDate != null ? tDate.toString() : "");

            DateWiseReconSummaryDTO summary = summaryMap.computeIfAbsent(key, k -> {
                DateWiseReconSummaryDTO s = new DateWiseReconSummaryDTO();
                s.setPlazaId(pId);
                s.setPlazaName(pName);
                s.setTxnDate(tDate);
                s.setTxnCount(0L);
                s.setSettledAmount(BigDecimal.ZERO);
                return s;
            });

            summary.setTxnCount(summary.getTxnCount() + cnt);
            summary.setSettledAmount(summary.getSettledAmount().add(amt));

            DateWiseBreakdownDTO breakdown = new DateWiseBreakdownDTO(sDate, cnt, amt);
            summary.getBreakdowns().add(breakdown);
        }

        return new ArrayList<>(summaryMap.values());
    }

    /**
     * Stream Excel export with hierarchical parent and child breakdown rows
     */
    public void streamExcelExport(LocalDateTime fromDate, LocalDateTime toDate, String plazaId, OutputStream outputStream) throws Exception {
        List<DateWiseReconSummaryDTO> records = searchDateWiseRecon(fromDate, toDate, plazaId);

        try (SXSSFWorkbook workbook = new SXSSFWorkbook(100)) {
            Sheet sheet = workbook.createSheet("Date Wise Recon");
            DataFormat df = workbook.createDataFormat();

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
            Font hFont = workbook.createFont();
            hFont.setFontName("Calibri");
            hFont.setFontHeightInPoints((short) 11);
            hFont.setBold(true);
            hFont.setColor(IndexedColors.WHITE.getIndex());
            headerStyle.setFont(hFont);
            headerStyle.setFillForegroundColor(IndexedColors.DARK_BLUE.getIndex());
            headerStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            headerStyle.setAlignment(HorizontalAlignment.CENTER);
            headerStyle.setVerticalAlignment(VerticalAlignment.CENTER);
            headerStyle.setBorderBottom(BorderStyle.THIN);
            headerStyle.setBorderTop(BorderStyle.THIN);
            headerStyle.setBorderLeft(BorderStyle.THIN);
            headerStyle.setBorderRight(BorderStyle.THIN);

            // 5. Parent Group Summary Row Styles (Soft Pale Blue fill, Bold Navy text)
            Font parentFont = workbook.createFont();
            parentFont.setFontName("Calibri");
            parentFont.setFontHeightInPoints((short) 11);
            parentFont.setBold(true);
            parentFont.setColor(IndexedColors.DARK_BLUE.getIndex());

            CellStyle parentTextStyle = workbook.createCellStyle();
            parentTextStyle.setFont(parentFont);
            parentTextStyle.setFillForegroundColor(IndexedColors.PALE_BLUE.getIndex());
            parentTextStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            parentTextStyle.setVerticalAlignment(VerticalAlignment.CENTER);
            parentTextStyle.setBorderBottom(BorderStyle.THIN);
            parentTextStyle.setBorderTop(BorderStyle.THIN);
            parentTextStyle.setBorderLeft(BorderStyle.THIN);
            parentTextStyle.setBorderRight(BorderStyle.THIN);

            CellStyle parentCenterStyle = workbook.createCellStyle();
            parentCenterStyle.setFont(parentFont);
            parentCenterStyle.setFillForegroundColor(IndexedColors.PALE_BLUE.getIndex());
            parentCenterStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            parentCenterStyle.setAlignment(HorizontalAlignment.CENTER);
            parentCenterStyle.setVerticalAlignment(VerticalAlignment.CENTER);
            parentCenterStyle.setBorderBottom(BorderStyle.THIN);
            parentCenterStyle.setBorderTop(BorderStyle.THIN);
            parentCenterStyle.setBorderLeft(BorderStyle.THIN);
            parentCenterStyle.setBorderRight(BorderStyle.THIN);

            CellStyle parentAmtStyle = workbook.createCellStyle();
            parentAmtStyle.setFont(parentFont);
            parentAmtStyle.setFillForegroundColor(IndexedColors.PALE_BLUE.getIndex());
            parentAmtStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            parentAmtStyle.setAlignment(HorizontalAlignment.RIGHT);
            parentAmtStyle.setVerticalAlignment(VerticalAlignment.CENTER);
            parentAmtStyle.setDataFormat(df.getFormat("#,##0.00"));
            parentAmtStyle.setBorderBottom(BorderStyle.THIN);
            parentAmtStyle.setBorderTop(BorderStyle.THIN);
            parentAmtStyle.setBorderLeft(BorderStyle.THIN);
            parentAmtStyle.setBorderRight(BorderStyle.THIN);

            // 6. Child Breakdown Sub-Header Style (Royal Blue fill, Bold White text)
            CellStyle childHeaderStyle = workbook.createCellStyle();
            Font chFont = workbook.createFont();
            chFont.setFontName("Calibri");
            chFont.setFontHeightInPoints((short) 10);
            chFont.setBold(true);
            chFont.setColor(IndexedColors.WHITE.getIndex());
            childHeaderStyle.setFont(chFont);
            childHeaderStyle.setFillForegroundColor(IndexedColors.ROYAL_BLUE.getIndex());
            childHeaderStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            childHeaderStyle.setAlignment(HorizontalAlignment.CENTER);
            childHeaderStyle.setVerticalAlignment(VerticalAlignment.CENTER);
            childHeaderStyle.setBorderBottom(BorderStyle.THIN);
            childHeaderStyle.setBorderTop(BorderStyle.THIN);
            childHeaderStyle.setBorderLeft(BorderStyle.THIN);
            childHeaderStyle.setBorderRight(BorderStyle.THIN);

            // 7. Data Cell Styles (with thin borders)
            CellStyle textStyle = workbook.createCellStyle();
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

            CellStyle childSettlementDateStyle = workbook.createCellStyle();
            Font orangeFont = workbook.createFont();
            orangeFont.setFontName("Calibri");
            orangeFont.setBold(true);
            orangeFont.setColor(IndexedColors.DARK_RED.getIndex());
            childSettlementDateStyle.setFont(orangeFont);
            childSettlementDateStyle.setAlignment(HorizontalAlignment.CENTER);
            childSettlementDateStyle.setVerticalAlignment(VerticalAlignment.CENTER);
            childSettlementDateStyle.setBorderBottom(BorderStyle.THIN);
            childSettlementDateStyle.setBorderTop(BorderStyle.THIN);
            childSettlementDateStyle.setBorderLeft(BorderStyle.THIN);
            childSettlementDateStyle.setBorderRight(BorderStyle.THIN);

            CellStyle numStyle = workbook.createCellStyle();
            numStyle.setAlignment(HorizontalAlignment.RIGHT);
            numStyle.setVerticalAlignment(VerticalAlignment.CENTER);
            numStyle.setDataFormat(df.getFormat("#,##0.00"));
            numStyle.setBorderBottom(BorderStyle.THIN);
            numStyle.setBorderTop(BorderStyle.THIN);
            numStyle.setBorderLeft(BorderStyle.THIN);
            numStyle.setBorderRight(BorderStyle.THIN);

            CellStyle settledStyle = workbook.createCellStyle();
            settledStyle.setAlignment(HorizontalAlignment.RIGHT);
            settledStyle.setVerticalAlignment(VerticalAlignment.CENTER);
            settledStyle.setDataFormat(df.getFormat("#,##0.00"));
            settledStyle.setFillForegroundColor(IndexedColors.LIGHT_GREEN.getIndex());
            settledStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            settledStyle.setBorderBottom(BorderStyle.THIN);
            settledStyle.setBorderTop(BorderStyle.THIN);
            settledStyle.setBorderLeft(BorderStyle.THIN);
            settledStyle.setBorderRight(BorderStyle.THIN);
            Font settledFont = workbook.createFont();
            settledFont.setBold(true);
            settledFont.setColor(IndexedColors.DARK_GREEN.getIndex());
            settledStyle.setFont(settledFont);

            // 8. Total Summary Row Styles (Grey-25 fill, Bold text, Double bottom border)
            Font totalFont = workbook.createFont();
            totalFont.setFontName("Calibri");
            totalFont.setFontHeightInPoints((short) 11);
            totalFont.setBold(true);
            totalFont.setColor(IndexedColors.BLACK.getIndex());

            CellStyle totalLabelStyle = workbook.createCellStyle();
            totalLabelStyle.setFont(totalFont);
            totalLabelStyle.setVerticalAlignment(VerticalAlignment.CENTER);
            totalLabelStyle.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
            totalLabelStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            totalLabelStyle.setBorderTop(BorderStyle.THIN);
            totalLabelStyle.setBorderBottom(BorderStyle.DOUBLE);
            totalLabelStyle.setBorderLeft(BorderStyle.THIN);
            totalLabelStyle.setBorderRight(BorderStyle.THIN);

            CellStyle totalCenterStyle = workbook.createCellStyle();
            totalCenterStyle.setFont(totalFont);
            totalCenterStyle.setAlignment(HorizontalAlignment.CENTER);
            totalCenterStyle.setVerticalAlignment(VerticalAlignment.CENTER);
            totalCenterStyle.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
            totalCenterStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            totalCenterStyle.setBorderTop(BorderStyle.THIN);
            totalCenterStyle.setBorderBottom(BorderStyle.DOUBLE);
            totalCenterStyle.setBorderLeft(BorderStyle.THIN);
            totalCenterStyle.setBorderRight(BorderStyle.THIN);

            CellStyle totalAmtStyle = workbook.createCellStyle();
            totalAmtStyle.setFont(totalFont);
            totalAmtStyle.setAlignment(HorizontalAlignment.RIGHT);
            totalAmtStyle.setVerticalAlignment(VerticalAlignment.CENTER);
            totalAmtStyle.setDataFormat(df.getFormat("#,##0.00"));
            totalAmtStyle.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
            totalAmtStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            totalAmtStyle.setBorderTop(BorderStyle.THIN);
            totalAmtStyle.setBorderBottom(BorderStyle.DOUBLE);
            totalAmtStyle.setBorderLeft(BorderStyle.THIN);
            totalAmtStyle.setBorderRight(BorderStyle.THIN);

            String[] headers = {"Plaza ID", "Plaza Name", "Txn Date", "Settlement Date", "Txn Count", "Settled Amount"};

            // Row 0: Title Banner (Centered in the middle of the table)
            Row titleRow = sheet.createRow(0);
            titleRow.setHeightInPoints(28);
            Cell titleCell = titleRow.createCell(0);
            titleCell.setCellValue("DATE WISE RECONCILIATION REPORT");
            titleCell.setCellStyle(titleStyle);
            sheet.addMergedRegion(new CellRangeAddress(0, 0, 0, headers.length - 1));

            // Row 1: Subtitle with Date Range (Centered in the middle of the table)
            Row subRow = sheet.createRow(1);
            subRow.setHeightInPoints(18);
            Cell subCell = subRow.createCell(0);
            DateTimeFormatter dtf = DateTimeFormatter.ofPattern("dd-MM-yyyy HH:mm:ss");
            String fromStr = fromDate != null ? fromDate.format(dtf) : "01-08-2026 00:00:00";
            String toStr = toDate != null ? toDate.format(dtf) : "31-10-2026 23:59:59";
            subCell.setCellValue("From Date: " + fromStr + "   |   To Date: " + toStr);
            subCell.setCellStyle(subTitleStyle);
            sheet.addMergedRegion(new CellRangeAddress(1, 1, 0, headers.length - 1));

            // Row 2: Green Accent Bar
            Row greenRow = sheet.createRow(2);
            greenRow.setHeightInPoints(5);
            for (int i = 0; i < headers.length; i++) {
                Cell gc = greenRow.createCell(i);
                gc.setCellStyle(greenBarStyle);
            }

            // Row 3: Main Table Header Row
            Row hRow = sheet.createRow(3);
            hRow.setHeightInPoints(26);
            for (int i = 0; i < headers.length; i++) {
                Cell c = hRow.createCell(i);
                c.setCellValue(headers[i]);
                c.setCellStyle(headerStyle);
            }

            // Rows 4+: Hierarchical Data Rows exactly matching Image 2
            long grandTotalCount = 0;
            double grandTotalAmount = 0.0;

            int rowIdx = 4;
            for (DateWiseReconSummaryDTO summary : records) {
                grandTotalCount += (summary.getTxnCount() != null ? summary.getTxnCount() : 0);
                grandTotalAmount += (summary.getSettledAmount() != null ? summary.getSettledAmount().doubleValue() : 0.0);

                // A. Parent Group Summary Row (Level 1 in Image 2)
                Row pRow = sheet.createRow(rowIdx++);
                pRow.setHeightInPoints(22);

                Cell pc0 = pRow.createCell(0); pc0.setCellValue(summary.getPlazaId()); pc0.setCellStyle(parentCenterStyle);
                Cell pc1 = pRow.createCell(1); pc1.setCellValue(summary.getPlazaName()); pc1.setCellStyle(parentTextStyle);
                Cell pc2 = pRow.createCell(2); pc2.setCellValue(summary.getTxnDate() != null ? summary.getTxnDate().format(DATE_FMT) : ""); pc2.setCellStyle(parentCenterStyle);
                Cell pc3 = pRow.createCell(3); pc3.setCellValue("—"); pc3.setCellStyle(parentCenterStyle);
                Cell pc4 = pRow.createCell(4); pc4.setCellValue(summary.getTxnCount() != null ? summary.getTxnCount() : 0); pc4.setCellStyle(parentCenterStyle);
                Cell pc5 = pRow.createCell(5);
                pc5.setCellValue(summary.getSettledAmount() != null ? summary.getSettledAmount().doubleValue() : 0.0);
                pc5.setCellStyle(parentAmtStyle);

                // B. Sub-Table Header Row (Level 2 header in Image 2)
                Row chRow = sheet.createRow(rowIdx++);
                chRow.setHeightInPoints(20);
                for (int i = 0; i < headers.length; i++) {
                    Cell chc = chRow.createCell(i);
                    chc.setCellValue(headers[i]);
                    chc.setCellStyle(childHeaderStyle);
                }

                // C. Child Breakdown Data Rows
                if (summary.getBreakdowns() != null && !summary.getBreakdowns().isEmpty()) {
                    for (DateWiseBreakdownDTO b : summary.getBreakdowns()) {
                        Row cRow = sheet.createRow(rowIdx++);
                        cRow.setHeightInPoints(20);

                        Cell c0 = cRow.createCell(0); c0.setCellValue(summary.getPlazaId()); c0.setCellStyle(centerStyle);
                        Cell c1 = cRow.createCell(1); c1.setCellValue(summary.getPlazaName()); c1.setCellStyle(textStyle);
                        Cell c2 = cRow.createCell(2); c2.setCellValue(summary.getTxnDate() != null ? summary.getTxnDate().format(DATE_FMT) : ""); c2.setCellStyle(centerStyle);
                        Cell c3 = cRow.createCell(3); c3.setCellValue(b.getSettlementDate() != null ? b.getSettlementDate().format(DATE_FMT) : ""); c3.setCellStyle(childSettlementDateStyle);
                        Cell c4 = cRow.createCell(4); c4.setCellValue(b.getTxnCount() != null ? b.getTxnCount() : 0); c4.setCellStyle(centerStyle);
                        Cell c5 = cRow.createCell(5);
                        c5.setCellValue(b.getSettledAmount() != null ? b.getSettledAmount().doubleValue() : 0.0);
                        c5.setCellStyle(settledStyle);
                    }
                } else {
                    Row cRow = sheet.createRow(rowIdx++);
                    cRow.setHeightInPoints(20);

                    Cell c0 = cRow.createCell(0); c0.setCellValue(summary.getPlazaId()); c0.setCellStyle(centerStyle);
                    Cell c1 = cRow.createCell(1); c1.setCellValue(summary.getPlazaName()); c1.setCellStyle(textStyle);
                    Cell c2 = cRow.createCell(2); c2.setCellValue(summary.getTxnDate() != null ? summary.getTxnDate().format(DATE_FMT) : ""); c2.setCellStyle(centerStyle);
                    Cell c3 = cRow.createCell(3); c3.setCellValue("-"); c3.setCellStyle(childSettlementDateStyle);
                    Cell c4 = cRow.createCell(4); c4.setCellValue(summary.getTxnCount() != null ? summary.getTxnCount() : 0); c4.setCellStyle(centerStyle);
                    Cell c5 = cRow.createCell(5);
                    c5.setCellValue(summary.getSettledAmount() != null ? summary.getSettledAmount().doubleValue() : 0.0);
                    c5.setCellStyle(settledStyle);
                }
            }

            // D. Grand Total Summary Row (Matching tfoot in Image 2)
            Row totRow = sheet.createRow(rowIdx++);
            totRow.setHeightInPoints(24);
            Cell tc0 = totRow.createCell(0); tc0.setCellValue("Total"); tc0.setCellStyle(totalLabelStyle);
            Cell tc1 = totRow.createCell(1); tc1.setCellValue(""); tc1.setCellStyle(totalLabelStyle);
            Cell tc2 = totRow.createCell(2); tc2.setCellValue(""); tc2.setCellStyle(totalLabelStyle);
            Cell tc3 = totRow.createCell(3); tc3.setCellValue(""); tc3.setCellStyle(totalLabelStyle);
            Cell tc4 = totRow.createCell(4); tc4.setCellValue(grandTotalCount); tc4.setCellStyle(totalCenterStyle);
            Cell tc5 = totRow.createCell(5); tc5.setCellValue(grandTotalAmount); tc5.setCellStyle(totalAmtStyle);

            int[] colWidths = {16, 28, 22, 22, 16, 22};
            for (int i = 0; i < headers.length; i++) {
                int w = (i < colWidths.length) ? colWidths[i] : 20;
                sheet.setColumnWidth(i, w * 256);
            }

            workbook.write(outputStream);
            workbook.dispose();
            log.info("Streamed Date Wise Recon Excel with {} parent summary rows", records.size());
        }
    }

    private LocalDate parseLocalDate(Object val) {
        if (val == null) return null;
        if (val instanceof LocalDate) return (LocalDate) val;
        if (val instanceof Date) return ((Date) val).toLocalDate();
        try {
            return LocalDate.parse(val.toString().substring(0, 10));
        } catch (Exception e) {
            return null;
        }
    }
}
