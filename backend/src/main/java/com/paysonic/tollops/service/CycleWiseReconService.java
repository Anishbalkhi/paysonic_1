package com.paysonic.tollops.service;

import com.paysonic.tollops.dto.CycleWiseReconDTO;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.Query;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.streaming.SXSSFSheet;
import org.apache.poi.xssf.streaming.SXSSFWorkbook;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.OutputStream;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.Date;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
public class CycleWiseReconService {

    private static final Logger log = LoggerFactory.getLogger(CycleWiseReconService.class);
    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("dd-MM-yyyy");

    private static final BigDecimal MDR_RATE = new BigDecimal("0.006");     // 0.60% Acquirer Service Fee
    private static final BigDecimal GST_RATE = new BigDecimal("0.18");      // 18.00% GST
    private static final BigDecimal NPCI_RATE = new BigDecimal("0.013");    // 1.30% NPCI Clearing Fee

    @PersistenceContext
    private EntityManager entityManager;

    /**
     * Search and aggregate transactions into Cycle Wise Recon DTOs
     */
    @SuppressWarnings("unchecked")
    public List<CycleWiseReconDTO> searchCycleWiseRecon(LocalDateTime fromDate, LocalDateTime toDate, String plazaId, String cycle) {
        StringBuilder sql = new StringBuilder();
        sql.append("SELECT ")
           .append("  t.plaza_id, ")
           .append("  t.plaza_name, ")
           .append("  CAST(COALESCE(t.plaza_settle_date, t.npci_settled_date, t.txn_date) AS DATE) AS settle_dt, ")
           .append("  COALESCE(t.clearing_cycle, '1') AS cycle_val, ")
           .append("  COUNT(CASE WHEN (t.is_dispute_add IS NULL OR t.is_dispute_add != 'Yes') AND (t.is_dispute_sub IS NULL OR t.is_dispute_sub != 'Yes') THEN 1 ELSE NULL END) AS txn_cnt, ")
           .append("  COALESCE(SUM(CASE WHEN (t.is_dispute_add IS NULL OR t.is_dispute_add != 'Yes') AND (t.is_dispute_sub IS NULL OR t.is_dispute_sub != 'Yes') THEN t.txn_amount ELSE 0 END), 0) AS txn_amt, ")
           .append("  COUNT(CASE WHEN t.is_dispute_add = 'Yes' THEN 1 ELSE NULL END) AS disp_add_cnt, ")
           .append("  COALESCE(SUM(CASE WHEN t.is_dispute_add = 'Yes' THEN COALESCE(t.dispute_add_amount, t.txn_amount, 0) ELSE 0 END), 0) AS disp_add_amt, ")
           .append("  COUNT(CASE WHEN t.is_dispute_sub = 'Yes' THEN 1 ELSE NULL END) AS disp_sub_cnt, ")
           .append("  COALESCE(SUM(CASE WHEN t.is_dispute_sub = 'Yes' THEN COALESCE(t.dispute_sub_amount, t.txn_amount, 0) ELSE 0 END), 0) AS disp_sub_amt ")
           .append("FROM toll_transactions t ")
           .append("WHERE t.status = 'Settled' ");

        if (fromDate != null) {
            sql.append("  AND COALESCE(t.plaza_settle_date, t.npci_settled_date, t.txn_date) >= :fromDate ");
        }
        if (toDate != null) {
            sql.append("  AND COALESCE(t.plaza_settle_date, t.npci_settled_date, t.txn_date) <= :toDate ");
        }
        if (plazaId != null && !plazaId.trim().isEmpty() && !plazaId.equalsIgnoreCase("ALL")) {
            sql.append("  AND (t.plaza_id = :plazaId OR LOWER(t.plaza_name) LIKE LOWER(:plazaSearch)) ");
        }
        if (cycle != null && !cycle.trim().isEmpty() && !cycle.equalsIgnoreCase("ALL")) {
            sql.append("  AND (t.clearing_cycle = :cycle OR t.clearing_cycle = :cPrefixCycle) ");
        }

        sql.append("GROUP BY t.plaza_id, t.plaza_name, CAST(COALESCE(t.plaza_settle_date, t.npci_settled_date, t.txn_date) AS DATE), COALESCE(t.clearing_cycle, '1') ")
           .append("ORDER BY t.plaza_id ASC, settle_dt ASC, cycle_val ASC");

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
        if (cycle != null && !cycle.trim().isEmpty() && !cycle.equalsIgnoreCase("ALL")) {
            String cleanCycle = cycle.trim().toUpperCase().replace("CYCLE", "").replace("C", "").trim();
            query.setParameter("cycle", cleanCycle);
            query.setParameter("cPrefixCycle", "C" + cleanCycle);
        }

        List<Object[]> rawList = query.getResultList();
        List<CycleWiseReconDTO> dtoList = new ArrayList<>();

        for (Object[] row : rawList) {
            String pId = row[0] != null ? row[0].toString() : "";
            String pName = row[1] != null ? row[1].toString() : "";
            LocalDate sDate = parseLocalDate(row[2]);
            String rawCycle = row[3] != null ? row[3].toString() : "1";
            String reconCycle = normalizeCycle(rawCycle);

            long txnCount = ((Number) row[4]).longValue();
            BigDecimal txnAmount = new BigDecimal(row[5].toString()).setScale(2, RoundingMode.HALF_UP);

            long dispAddCount = ((Number) row[6]).longValue();
            BigDecimal dispAddAmount = new BigDecimal(row[7].toString()).setScale(2, RoundingMode.HALF_UP);

            long dispSubCount = ((Number) row[8]).longValue();
            BigDecimal dispSubAmount = new BigDecimal(row[9].toString()).setScale(2, RoundingMode.HALF_UP);

            // Calculations per specification:
            // 1. Total Amount = Txn Amount + Dispute Add Amount - Dispute Sub Amount
            BigDecimal totalAmount = txnAmount.add(dispAddAmount).subtract(dispSubAmount).setScale(2, RoundingMode.HALF_UP);

            // 2. Service Fees = 0.60% of Total Amount
            BigDecimal serviceFees = totalAmount.multiply(MDR_RATE).setScale(2, RoundingMode.HALF_UP);

            // 3. Service GST = 18% of Service Fees
            BigDecimal serviceGst = serviceFees.multiply(GST_RATE).setScale(2, RoundingMode.HALF_UP);

            // 4. 0.013 GST(1.30%) = 1.30% of Total Amount
            BigDecimal fee130 = totalAmount.multiply(NPCI_RATE).setScale(2, RoundingMode.HALF_UP);

            // 5. GST(1.30%) = 18% of the 1.30% fee
            BigDecimal gstOnFee130 = fee130.multiply(GST_RATE).setScale(2, RoundingMode.HALF_UP);

            // 6. Settled Amount = Total Amount - (Service Fees + Service GST + 1.30% Fee + GST on 1.30% Fee)
            BigDecimal totalDeductions = serviceFees.add(serviceGst).add(fee130).add(gstOnFee130);
            BigDecimal settledAmount = totalAmount.subtract(totalDeductions).setScale(2, RoundingMode.HALF_UP);

            CycleWiseReconDTO dto = new CycleWiseReconDTO(
                    pId, pName, sDate, reconCycle,
                    txnCount, txnAmount,
                    dispAddCount, dispAddAmount,
                    dispSubCount, dispSubAmount,
                    totalAmount, serviceFees, serviceGst,
                    fee130, gstOnFee130, settledAmount
            );

            dtoList.add(dto);
        }

        return dtoList;
    }

    /**
     * Stream Excel file matching exact spreadsheet format and column layout
     */
    public void streamExcelExport(LocalDateTime fromDate, LocalDateTime toDate, String plazaId, String cycle, OutputStream outputStream) throws Exception {
        List<CycleWiseReconDTO> records = searchCycleWiseRecon(fromDate, toDate, plazaId, cycle);

        try (SXSSFWorkbook workbook = new SXSSFWorkbook(100)) {
            Sheet sheet = workbook.createSheet("Cycle Wise Report");
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
            hFont.setBold(true);
            hFont.setFontName("Calibri");
            hFont.setFontHeightInPoints((short) 11);
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

            // Number Styles
            CellStyle intStyle = workbook.createCellStyle();
            intStyle.setAlignment(HorizontalAlignment.RIGHT);
            intStyle.setVerticalAlignment(VerticalAlignment.CENTER);
            intStyle.setDataFormat(df.getFormat("#,##0"));
            intStyle.setBorderBottom(BorderStyle.THIN);
            intStyle.setBorderTop(BorderStyle.THIN);
            intStyle.setBorderLeft(BorderStyle.THIN);
            intStyle.setBorderRight(BorderStyle.THIN);

            CellStyle decStyle = workbook.createCellStyle();
            decStyle.setAlignment(HorizontalAlignment.RIGHT);
            decStyle.setVerticalAlignment(VerticalAlignment.CENTER);
            decStyle.setDataFormat(df.getFormat("#,##0.00"));
            decStyle.setBorderBottom(BorderStyle.THIN);
            decStyle.setBorderTop(BorderStyle.THIN);
            decStyle.setBorderLeft(BorderStyle.THIN);
            decStyle.setBorderRight(BorderStyle.THIN);

            // Settled Amount Highlight Style (Soft green fill, bold dark green text)
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

            String[] headers = {
                "Plaza Id", "Plaza Name", "Plaza Settlement Date", "Recon Cycle",
                "Txn Count", "Txn Amount", "Dispute Add Count", "Dispute Add Amount",
                "Dispute Sub Count", "Dispute Sub Amount", "Total Amount",
                "Service Fees", "Service GST", "0.013 GST(1.30%)", "GST(1.30%)", "Settled Amount"
            };

            // Row 0: Title Banner
            Row titleRow = sheet.createRow(0);
            titleRow.setHeightInPoints(28);
            Cell titleCell = titleRow.createCell(0);
            titleCell.setCellValue("CYCLE WISE RECONCILIATION REPORT");
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
            int plazaStartRow = 4;
            String currentPlazaId = null;

            for (int r = 0; r < records.size(); r++) {
                CycleWiseReconDTO item = records.get(r);
                Row row = sheet.createRow(rowIdx);
                row.setHeightInPoints(20);

                // Check for plaza grouping for merged cells
                if (currentPlazaId == null) {
                    currentPlazaId = item.getPlazaId();
                    plazaStartRow = rowIdx;
                } else if (!currentPlazaId.equals(item.getPlazaId())) {
                    // Merge previous plaza cells if more than 1 row
                    if (rowIdx - 1 > plazaStartRow) {
                        sheet.addMergedRegion(new CellRangeAddress(plazaStartRow, rowIdx - 1, 0, 0));
                        sheet.addMergedRegion(new CellRangeAddress(plazaStartRow, rowIdx - 1, 1, 1));
                    }
                    currentPlazaId = item.getPlazaId();
                    plazaStartRow = rowIdx;
                }

                Cell c0 = row.createCell(0);
                c0.setCellValue(item.getPlazaId());
                c0.setCellStyle(centerStyle);

                Cell c1 = row.createCell(1);
                c1.setCellValue(item.getPlazaName());
                c1.setCellStyle(textStyle);

                Cell c2 = row.createCell(2);
                c2.setCellValue(item.getPlazaSettlementDate() != null ? item.getPlazaSettlementDate().format(DATE_FMT) : "");
                c2.setCellStyle(centerStyle);

                Cell c3 = row.createCell(3);
                c3.setCellValue(item.getReconCycle());
                c3.setCellStyle(centerStyle);

                Cell c4 = row.createCell(4);
                c4.setCellValue(item.getTxnCount());
                c4.setCellStyle(intStyle);

                Cell c5 = row.createCell(5);
                c5.setCellValue(item.getTxnAmount().doubleValue());
                c5.setCellStyle(decStyle);

                Cell c6 = row.createCell(6);
                c6.setCellValue(item.getDisputeAddCount());
                c6.setCellStyle(intStyle);

                Cell c7 = row.createCell(7);
                c7.setCellValue(item.getDisputeAddAmount().doubleValue());
                c7.setCellStyle(decStyle);

                Cell c8 = row.createCell(8);
                c8.setCellValue(item.getDisputeSubCount());
                c8.setCellStyle(intStyle);

                Cell c9 = row.createCell(9);
                c9.setCellValue(item.getDisputeSubAmount().doubleValue());
                c9.setCellStyle(decStyle);

                Cell c10 = row.createCell(10);
                c10.setCellValue(item.getTotalAmount().doubleValue());
                c10.setCellStyle(decStyle);

                Cell c11 = row.createCell(11);
                c11.setCellValue(item.getServiceFees().doubleValue());
                c11.setCellStyle(decStyle);

                Cell c12 = row.createCell(12);
                c12.setCellValue(item.getServiceGst().doubleValue());
                c12.setCellStyle(decStyle);

                Cell c13 = row.createCell(13);
                c13.setCellValue(item.getFee130().doubleValue());
                c13.setCellStyle(decStyle);

                Cell c14 = row.createCell(14);
                c14.setCellValue(item.getGstOnFee130().doubleValue());
                c14.setCellStyle(decStyle);

                Cell c15 = row.createCell(15);
                c15.setCellValue(item.getSettledAmount().doubleValue());
                c15.setCellStyle(settledStyle);

                rowIdx++;
            }

            // Merge final plaza group if needed
            if (currentPlazaId != null && rowIdx - 1 > plazaStartRow) {
                sheet.addMergedRegion(new CellRangeAddress(plazaStartRow, rowIdx - 1, 0, 0));
                sheet.addMergedRegion(new CellRangeAddress(plazaStartRow, rowIdx - 1, 1, 1));
            }

            // Generous column widths so Plaza Settlement Date never shows ########
            int[] colWidths = {
                14, // Plaza Id
                26, // Plaza Name
                24, // Plaza Settlement Date (prevents ########)
                14, // Recon Cycle
                14, // Txn Count
                18, // Txn Amount
                18, // Dispute Add Count
                20, // Dispute Add Amount
                18, // Dispute Sub Count
                20, // Dispute Sub Amount
                20, // Total Amount
                18, // Service Fees
                18, // Service GST
                18, // 0.013 GST(1.30%)
                18, // GST(1.30%)
                22  // Settled Amount
            };
            for (int i = 0; i < headers.length; i++) {
                int w = (i < colWidths.length) ? colWidths[i] : 18;
                sheet.setColumnWidth(i, w * 256);
            }

            workbook.write(outputStream);
            workbook.dispose();
            log.info("Streamed Cycle Wise Recon Excel with {} records", records.size());
        }
    }

    private String normalizeCycle(String cycle) {
        if (cycle == null || cycle.trim().isEmpty()) return "1";
        String s = cycle.trim().toUpperCase().replace("CYCLE", "").replace("C", "").trim();
        return s.isEmpty() ? "1" : s;
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
