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
            CellStyle numStyle = workbook.createCellStyle();
            numStyle.setDataFormat(df.getFormat("#,##0.00"));

            // Parent Header Style
            CellStyle headerStyle = workbook.createCellStyle();
            Font hFont = workbook.createFont();
            hFont.setBold(true);
            hFont.setColor(IndexedColors.WHITE.getIndex());
            headerStyle.setFont(hFont);
            headerStyle.setFillForegroundColor(IndexedColors.DARK_BLUE.getIndex());
            headerStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);

            // Child Row Style
            CellStyle childStyle = workbook.createCellStyle();
            childStyle.setFillForegroundColor(IndexedColors.LIGHT_YELLOW.getIndex());
            childStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);

            String[] headers = {"Plaza ID", "Plaza Name", "Txn Date", "Settlement Date", "Txn Count", "Settled Amount"};
            Row hRow = sheet.createRow(0);
            for (int i = 0; i < headers.length; i++) {
                Cell c = hRow.createCell(i);
                c.setCellValue(headers[i]);
                c.setCellStyle(headerStyle);
            }

            int rowIdx = 1;
            for (DateWiseReconSummaryDTO summary : records) {
                // Summary (Parent Level)
                Row pRow = sheet.createRow(rowIdx++);
                pRow.createCell(0).setCellValue(summary.getPlazaId());
                pRow.createCell(1).setCellValue(summary.getPlazaName());
                pRow.createCell(2).setCellValue(summary.getTxnDate() != null ? summary.getTxnDate().format(DATE_FMT) : "");
                pRow.createCell(3).setCellValue("TOTAL (ALL SETTLEMENT DATES)");
                pRow.createCell(4).setCellValue(summary.getTxnCount());
                Cell pAmt = pRow.createCell(5);
                pAmt.setCellValue(summary.getSettledAmount().doubleValue());
                pAmt.setCellStyle(numStyle);

                // Expanded Breakdown (Child Level)
                for (DateWiseBreakdownDTO b : summary.getBreakdowns()) {
                    Row cRow = sheet.createRow(rowIdx++);
                    cRow.createCell(0).setCellValue(summary.getPlazaId());
                    cRow.createCell(1).setCellValue(summary.getPlazaName());
                    cRow.createCell(2).setCellValue(summary.getTxnDate() != null ? summary.getTxnDate().format(DATE_FMT) : "");
                    cRow.createCell(3).setCellValue(b.getSettlementDate() != null ? b.getSettlementDate().format(DATE_FMT) : "");
                    cRow.createCell(4).setCellValue(b.getTxnCount());
                    Cell cAmt = cRow.createCell(5);
                    cAmt.setCellValue(b.getSettledAmount().doubleValue());
                    cAmt.setCellStyle(numStyle);
                }
            }

            for (int i = 0; i < headers.length; i++) {
                sheet.setColumnWidth(i, 20 * 256);
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
