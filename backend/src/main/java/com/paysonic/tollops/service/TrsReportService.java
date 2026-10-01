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

            // Text style for Acq Txn ID (prevents Excel scientific notation rounding)
            DataFormat dataFormat = workbook.createDataFormat();
            CellStyle textStyle = workbook.createCellStyle();
            textStyle.setDataFormat(dataFormat.getFormat("@"));

            // Header Style
            CellStyle headerStyle = workbook.createCellStyle();
            Font headerFont = workbook.createFont();
            headerFont.setBold(true);
            headerFont.setColor(IndexedColors.WHITE.getIndex());
            headerStyle.setFont(headerFont);
            headerStyle.setFillForegroundColor(IndexedColors.DARK_BLUE.getIndex());
            headerStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            headerStyle.setAlignment(HorizontalAlignment.CENTER);

            // Number Style
            CellStyle numberStyle = workbook.createCellStyle();
            numberStyle.setDataFormat(dataFormat.getFormat("#,##0.00"));

            String[] headers = {
                "Sr No", "Toll File Name", "Plaza ID", "Plaza Name", "Lane ID",
                "Tag ID", "VRN", "Acq Txn ID", "Toll Txn ID", "Toll Message ID",
                "MVC", "Tag VC", "AVC", "Transaction Status", "Reason",
                "Transaction Amount", "Settled Amount", "Transaction Date", "Plaza Post Date",
                "NPCI Error Code", "NPCI Settled Date", "NPCI Clearing Cycle", "Plaza Settlement Date",
                "Transaction Type", "NPCI Response Date", "Plaza Type", "Is Violation",
                "Audit VC", "Violation Settlement Amount", "Violation Settlement Date"
            };

            Row headerRow = sheet.createRow(0);
            for (int i = 0; i < headers.length; i++) {
                Cell cell = headerRow.createCell(i);
                cell.setCellValue(headers[i]);
                cell.setCellStyle(headerStyle);
            }

            int rowIdx = 1;
            for (TollTransaction t : records) {
                Row row = sheet.createRow(rowIdx);
                row.createCell(0).setCellValue(rowIdx);
                row.createCell(1).setCellValue(blankIfNull(t.getTollFileName()));
                row.createCell(2).setCellValue(blankIfNull(t.getPlazaId()));
                row.createCell(3).setCellValue(blankIfNull(t.getPlazaName()));
                row.createCell(4).setCellValue(blankIfNull(t.getLaneId()));
                row.createCell(5).setCellValue(blankIfNull(t.getTagId()));
                row.createCell(6).setCellValue(blankIfNull(t.getVrn()));

                // Acq Txn ID: MUST BE TEXT
                Cell acqCell = row.createCell(7);
                acqCell.setCellStyle(textStyle);
                acqCell.setCellValue(blankIfNull(t.getAcqTxnId()));

                row.createCell(8).setCellValue(blankIfNull(t.getTollTxnId()));
                row.createCell(9).setCellValue(blankIfNull(t.getTollMessageId()));
                row.createCell(10).setCellValue(blankIfNull(t.getMvc()));
                row.createCell(11).setCellValue(blankIfNull(t.getTagVc()));
                row.createCell(12).setCellValue(blankIfNull(t.getAvc()));
                row.createCell(13).setCellValue(blankIfNull(t.getStatus()));
                row.createCell(14).setCellValue(blankIfNull(t.getReason()));

                // Transaction Amount
                Cell txnAmtCell = row.createCell(15);
                if (t.getTxnAmount() != null) {
                    txnAmtCell.setCellValue(t.getTxnAmount().doubleValue());
                    txnAmtCell.setCellStyle(numberStyle);
                } else {
                    txnAmtCell.setCellValue("");
                }

                // Settled Amount (blank if rejected/null)
                Cell setAmtCell = row.createCell(16);
                if (t.getSettledAmount() != null) {
                    setAmtCell.setCellValue(t.getSettledAmount().doubleValue());
                    setAmtCell.setCellStyle(numberStyle);
                } else {
                    setAmtCell.setCellValue("");
                }

                row.createCell(17).setCellValue(formatDate(t.getTxnDate()));
                row.createCell(18).setCellValue(formatDate(t.getPlazaPostDate()));
                row.createCell(19).setCellValue(blankIfNull(t.getNpciErrorCode()));
                row.createCell(20).setCellValue(formatDate(t.getNpciSettledDate()));
                row.createCell(21).setCellValue(blankIfNull(t.getClearingCycle()));
                row.createCell(22).setCellValue(formatDate(t.getPlazaSettleDate()));
                row.createCell(23).setCellValue(blankIfNull(t.getTxnType()));
                row.createCell(24).setCellValue(formatDate(t.getNpciRespDate()));
                row.createCell(25).setCellValue(blankIfNull(t.getPlazaType()));
                row.createCell(26).setCellValue(blankIfNull(t.getIsViolation()));
                row.createCell(27).setCellValue(blankIfNull(t.getAuditVc()));

                // Violation Settled Amount
                Cell vAmtCell = row.createCell(28);
                if (t.getViolationSettledAmount() != null) {
                    vAmtCell.setCellValue(t.getViolationSettledAmount().doubleValue());
                    vAmtCell.setCellStyle(numberStyle);
                } else {
                    vAmtCell.setCellValue("");
                }

                row.createCell(29).setCellValue(formatDate(t.getViolationSettledDate()));
                rowIdx++;
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
