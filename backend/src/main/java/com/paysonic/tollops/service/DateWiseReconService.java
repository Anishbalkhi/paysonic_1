package com.paysonic.tollops.service;

import com.paysonic.tollops.dto.DateWiseBreakdownDTO;
import com.paysonic.tollops.dto.DateWiseReconSummaryDTO;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.Query;
import org.apache.poi.ss.usermodel.*;
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

            // 5. Data Cell Styles (with thin borders)
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

            String[] headers = {"Plaza ID", "Plaza Name", "Txn Date", "Settlement Date", "Txn Count", "Settled Amount"};

            // Row 0: Title Banner
            Row titleRow = sheet.createRow(0);
            titleRow.setHeightInPoints(28);
            Cell titleCell = titleRow.createCell(0);
            titleCell.setCellValue("DATE WISE RECONCILIATION REPORT");
            titleCell.setCellStyle(titleStyle);

            // Row 1: Subtitle with Date Range
            Row subRow = sheet.createRow(1);
            subRow.setHeightInPoints(18);
            Cell subCell = subRow.createCell(0);
            DateTimeFormatter dtf = DateTimeFormatter.ofPattern("dd-MM-yyyy HH:mm:ss");
            String fromStr = fromDate != null ? fromDate.format(dtf) : "01-08-2026 00:00:00";
            String toStr = toDate != null ? toDate.format(dtf) : "31-10-2026 23:59:59";
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
            Row hRow = sheet.createRow(3);
            hRow.setHeightInPoints(26);
            for (int i = 0; i < headers.length; i++) {
                Cell c = hRow.createCell(i);
                c.setCellValue(headers[i]);
                c.setCellStyle(headerStyle);
            }

            // Rows 4+: Data Rows
            int rowIdx = 4;
            for (DateWiseReconSummaryDTO summary : records) {
                if (summary.getBreakdowns() != null && !summary.getBreakdowns().isEmpty()) {
                    for (DateWiseBreakdownDTO b : summary.getBreakdowns()) {
                        Row row = sheet.createRow(rowIdx++);
                        row.setHeightInPoints(20);

                        Cell c0 = row.createCell(0); c0.setCellValue(summary.getPlazaId()); c0.setCellStyle(centerStyle);
                        Cell c1 = row.createCell(1); c1.setCellValue(summary.getPlazaName()); c1.setCellStyle(textStyle);
                        Cell c2 = row.createCell(2); c2.setCellValue(summary.getTxnDate() != null ? summary.getTxnDate().format(DATE_FMT) : ""); c2.setCellStyle(centerStyle);
                        Cell c3 = row.createCell(3); c3.setCellValue(b.getSettlementDate() != null ? b.getSettlementDate().format(DATE_FMT) : ""); c3.setCellStyle(centerStyle);
                        Cell c4 = row.createCell(4); c4.setCellValue(b.getTxnCount()); c4.setCellStyle(centerStyle);
                        Cell c5 = row.createCell(5);
                        c5.setCellValue(b.getSettledAmount() != null ? b.getSettledAmount().doubleValue() : 0.0);
                        c5.setCellStyle(settledStyle);
                    }
                } else {
                    Row row = sheet.createRow(rowIdx++);
                    row.setHeightInPoints(20);

                    Cell c0 = row.createCell(0); c0.setCellValue(summary.getPlazaId()); c0.setCellStyle(centerStyle);
                    Cell c1 = row.createCell(1); c1.setCellValue(summary.getPlazaName()); c1.setCellStyle(textStyle);
                    Cell c2 = row.createCell(2); c2.setCellValue(summary.getTxnDate() != null ? summary.getTxnDate().format(DATE_FMT) : ""); c2.setCellStyle(centerStyle);
                    Cell c3 = row.createCell(3); c3.setCellValue("-"); c3.setCellStyle(centerStyle);
                    Cell c4 = row.createCell(4); c4.setCellValue(summary.getTxnCount()); c4.setCellStyle(centerStyle);
                    Cell c5 = row.createCell(5);
                    c5.setCellValue(summary.getSettledAmount() != null ? summary.getSettledAmount().doubleValue() : 0.0);
                    c5.setCellStyle(settledStyle);
                }
            }

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
