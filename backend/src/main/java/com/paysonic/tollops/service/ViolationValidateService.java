package com.paysonic.tollops.service;

import com.paysonic.tollops.entity.ViolationValidateRecord;
import com.paysonic.tollops.repository.ViolationValidateRepository;
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
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
public class ViolationValidateService {

    private static final Logger log = LoggerFactory.getLogger(ViolationValidateService.class);
    private final ViolationValidateRepository repository;

    private static final DateTimeFormatter DATE_TIME_FMT = DateTimeFormatter.ofPattern("dd-MM-yyyy HH:mm:ss");

    public ViolationValidateService(ViolationValidateRepository repository) {
        this.repository = repository;
    }

    public Page<ViolationValidateRecord> searchRecords(
            LocalDateTime fromDate,
            LocalDateTime toDate,
            String plazaId,
            String auditRemark,
            String apiStatus,
            String vrn,
            String tagId,
            String acqTxnId,
            String tollTxnId,
            Pageable pageable) {

        Specification<ViolationValidateRecord> spec = buildSpecification(
                fromDate, toDate, plazaId, auditRemark, apiStatus, vrn, tagId, acqTxnId, tollTxnId
        );
        return repository.findAll(spec, pageable);
    }

    public Map<String, Object> calculateSummary(
            LocalDateTime fromDate,
            LocalDateTime toDate,
            String plazaId,
            String auditRemark,
            String apiStatus,
            String vrn,
            String tagId,
            String acqTxnId,
            String tollTxnId) {

        Specification<ViolationValidateRecord> spec = buildSpecification(
                fromDate, toDate, plazaId, auditRemark, apiStatus, vrn, tagId, acqTxnId, tollTxnId
        );
        List<ViolationValidateRecord> records = repository.findAll(spec);

        long totalCount = records.size();
        BigDecimal totalTxnAmount = BigDecimal.ZERO;
        long totalApproved = 0;
        long totalRejected = 0;
        Set<String> uniquePlazas = new HashSet<>();

        for (ViolationValidateRecord r : records) {
            BigDecimal txnAmt = r.getTxnAmount() != null ? r.getTxnAmount() : BigDecimal.ZERO;
            totalTxnAmount = totalTxnAmount.add(txnAmt);

            if ("APPROVED".equalsIgnoreCase(r.getViolationApiStatus())) {
                totalApproved++;
            } else if ("REJECTED".equalsIgnoreCase(r.getViolationApiStatus())) {
                totalRejected++;
            }

            if (r.getPlazaId() != null) {
                uniquePlazas.add(r.getPlazaId());
            }
        }

        Map<String, Object> summary = new HashMap<>();
        summary.put("totalCount", totalCount);
        summary.put("totalTxnAmount", totalTxnAmount);
        summary.put("totalApproved", totalApproved);
        summary.put("totalRejected", totalRejected);
        summary.put("uniquePlazas", uniquePlazas.size());
        return summary;
    }

    public void streamExcelExport(
            LocalDateTime fromDate,
            LocalDateTime toDate,
            String plazaId,
            String auditRemark,
            String apiStatus,
            String vrn,
            String tagId,
            String acqTxnId,
            String tollTxnId,
            OutputStream outputStream) throws Exception {

        Specification<ViolationValidateRecord> spec = buildSpecification(
                fromDate, toDate, plazaId, auditRemark, apiStatus, vrn, tagId, acqTxnId, tollTxnId
        );
        List<ViolationValidateRecord> records = repository.findAll(spec);

        try (SXSSFWorkbook workbook = new SXSSFWorkbook(100)) {
            Sheet sheet = workbook.createSheet("Violation Validate Report");
            DataFormat dataFormat = workbook.createDataFormat();

            // Title Style
            CellStyle titleStyle = workbook.createCellStyle();
            Font titleFont = workbook.createFont();
            titleFont.setFontName("Calibri");
            titleFont.setFontHeightInPoints((short) 16);
            titleFont.setBold(true);
            titleFont.setColor(IndexedColors.DARK_BLUE.getIndex());
            titleStyle.setFont(titleFont);
            titleStyle.setAlignment(HorizontalAlignment.CENTER);
            titleStyle.setVerticalAlignment(VerticalAlignment.CENTER);

            // Subtitle Style
            CellStyle subTitleStyle = workbook.createCellStyle();
            Font subFont = workbook.createFont();
            subFont.setFontName("Calibri");
            subFont.setFontHeightInPoints((short) 10);
            subFont.setColor(IndexedColors.GREY_50_PERCENT.getIndex());
            subTitleStyle.setFont(subFont);
            subTitleStyle.setAlignment(HorizontalAlignment.CENTER);
            subTitleStyle.setVerticalAlignment(VerticalAlignment.CENTER);

            // Header Style
            CellStyle headerStyle = workbook.createCellStyle();
            Font headerFont = workbook.createFont();
            headerFont.setFontName("Calibri");
            headerFont.setFontHeightInPoints((short) 11);
            headerFont.setBold(true);
            headerFont.setColor(IndexedColors.WHITE.getIndex());
            headerStyle.setFont(headerFont);
            headerStyle.setFillForegroundColor(IndexedColors.ROYAL_BLUE.getIndex());
            headerStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            headerStyle.setAlignment(HorizontalAlignment.CENTER);
            headerStyle.setVerticalAlignment(VerticalAlignment.CENTER);
            headerStyle.setBorderBottom(BorderStyle.THIN);

            // Data Cell Styles
            CellStyle textStyle = workbook.createCellStyle();
            textStyle.setAlignment(HorizontalAlignment.LEFT);
            textStyle.setVerticalAlignment(VerticalAlignment.CENTER);

            CellStyle centerStyle = workbook.createCellStyle();
            centerStyle.setAlignment(HorizontalAlignment.CENTER);
            centerStyle.setVerticalAlignment(VerticalAlignment.CENTER);

            CellStyle amountStyle = workbook.createCellStyle();
            amountStyle.setDataFormat(dataFormat.getFormat("#,##0.00"));
            amountStyle.setAlignment(HorizontalAlignment.RIGHT);
            amountStyle.setVerticalAlignment(VerticalAlignment.CENTER);

            int rowIdx = 0;

            // Row 0: Title Banner
            Row titleRow = sheet.createRow(rowIdx++);
            titleRow.setHeightInPoints(28);
            Cell titleCell = titleRow.createCell(0);
            titleCell.setCellValue("VIOLATION VALIDATE REPORT");
            titleCell.setCellStyle(titleStyle);
            sheet.addMergedRegion(new CellRangeAddress(0, 0, 0, 17));

            // Row 1: Subtitle
            Row subTitleRow = sheet.createRow(rowIdx++);
            subTitleRow.setHeightInPoints(18);
            Cell subTitleCell = subTitleRow.createCell(0);
            String fromStr = fromDate != null ? fromDate.format(DATE_TIME_FMT) : "Beginning";
            String toStr = toDate != null ? toDate.format(DATE_TIME_FMT) : "Now";
            subTitleCell.setCellValue("Date Range: " + fromStr + " to " + toStr + " | Generated from Paysonic Live Railway DB");
            subTitleCell.setCellStyle(subTitleStyle);
            sheet.addMergedRegion(new CellRangeAddress(1, 1, 0, 17));

            rowIdx++; // Empty row

            // Table Headers (18 columns)
            String[] headers = {
                    "Sr No", "Take Action", "Plaza ID", "Plaza Name", "VRN",
                    "Tag ID", "Acq Txn ID", "Toll Txn ID", "Txn Amount", "Txn Date Time",
                    "MVC", "AVC", "Audit VC", "Audit remark", "Audit Desc",
                    "Violation Img", "NETC Txn Type", "Violation API Status"
            };

            Row headerRow = sheet.createRow(rowIdx++);
            headerRow.setHeightInPoints(24);
            for (int i = 0; i < headers.length; i++) {
                Cell c = headerRow.createCell(i);
                c.setCellValue(headers[i]);
                c.setCellStyle(headerStyle);
            }

            // Populate rows
            int sr = 1;
            for (ViolationValidateRecord r : records) {
                Row row = sheet.createRow(rowIdx++);
                row.setHeightInPoints(18);

                // 0: Sr No
                Cell c0 = row.createCell(0);
                c0.setCellValue(r.getSrNo() != null ? r.getSrNo() : sr++);
                c0.setCellStyle(centerStyle);

                // 1: Take Action
                Cell c1 = row.createCell(1);
                c1.setCellValue(r.getTakeAction() != null ? r.getTakeAction() : "Actioned");
                c1.setCellStyle(centerStyle);

                // 2: Plaza ID
                Cell c2 = row.createCell(2);
                c2.setCellValue(r.getPlazaId() != null ? r.getPlazaId() : "");
                c2.setCellStyle(centerStyle);

                // 3: Plaza Name
                Cell c3 = row.createCell(3);
                c3.setCellValue(r.getPlazaName() != null ? r.getPlazaName() : "");
                c3.setCellStyle(textStyle);

                // 4: VRN
                Cell c4 = row.createCell(4);
                c4.setCellValue(r.getVrn() != null ? r.getVrn() : "");
                c4.setCellStyle(textStyle);

                // 5: Tag ID
                Cell c5 = row.createCell(5);
                c5.setCellValue(r.getTagId() != null ? r.getTagId() : "");
                c5.setCellStyle(textStyle);

                // 6: Acq Txn ID
                Cell c6 = row.createCell(6);
                c6.setCellValue(r.getAcqTxnId() != null ? r.getAcqTxnId() : "");
                c6.setCellStyle(textStyle);

                // 7: Toll Txn ID
                Cell c7 = row.createCell(7);
                c7.setCellValue(r.getTollTxnId() != null ? r.getTollTxnId() : "");
                c7.setCellStyle(textStyle);

                // 8: Txn Amount
                Cell c8 = row.createCell(8);
                c8.setCellValue(r.getTxnAmount() != null ? r.getTxnAmount().doubleValue() : 0.0);
                c8.setCellStyle(amountStyle);

                // 9: Txn Date Time
                Cell c9 = row.createCell(9);
                c9.setCellValue(r.getTxnDateTime() != null ? r.getTxnDateTime().format(DATE_TIME_FMT) : "");
                c9.setCellStyle(centerStyle);

                // 10: MVC
                Cell c10 = row.createCell(10);
                c10.setCellValue(r.getMvc() != null ? r.getMvc() : "");
                c10.setCellStyle(centerStyle);

                // 11: AVC
                Cell c11 = row.createCell(11);
                c11.setCellValue(r.getAvc() != null ? r.getAvc() : "");
                c11.setCellStyle(centerStyle);

                // 12: Audit VC
                Cell c12 = row.createCell(12);
                c12.setCellValue(r.getAuditVc() != null ? r.getAuditVc() : "");
                c12.setCellStyle(centerStyle);

                // 13: Audit remark
                Cell c13 = row.createCell(13);
                c13.setCellValue(r.getAuditRemark() != null ? r.getAuditRemark() : "");
                c13.setCellStyle(centerStyle);

                // 14: Audit Desc
                Cell c14 = row.createCell(14);
                c14.setCellValue(r.getAuditDesc() != null ? r.getAuditDesc() : "");
                c14.setCellStyle(textStyle);

                // 15: Violation Img
                Cell c15 = row.createCell(15);
                c15.setCellValue(r.getViolationImg() != null ? r.getViolationImg() : "YES");
                c15.setCellStyle(centerStyle);

                // 16: NETC Txn Type
                Cell c16 = row.createCell(16);
                c16.setCellValue(r.getNetcTxnType() != null ? r.getNetcTxnType() : "DEBIT");
                c16.setCellStyle(centerStyle);

                // 17: Violation API Status
                Cell c17 = row.createCell(17);
                c17.setCellValue(r.getViolationApiStatus() != null ? r.getViolationApiStatus() : "");
                c17.setCellStyle(centerStyle);
            }

            // Column Widths
            sheet.setColumnWidth(0, 2200);   // Sr No
            sheet.setColumnWidth(1, 3400);   // Take Action
            sheet.setColumnWidth(2, 3000);   // Plaza ID
            sheet.setColumnWidth(3, 5000);   // Plaza Name
            sheet.setColumnWidth(4, 4000);   // VRN
            sheet.setColumnWidth(5, 7500);   // Tag ID
            sheet.setColumnWidth(6, 6000);   // Acq Txn ID
            sheet.setColumnWidth(7, 4000);   // Toll Txn ID
            sheet.setColumnWidth(8, 3500);   // Txn Amount
            sheet.setColumnWidth(9, 5500);   // Txn Date Time
            sheet.setColumnWidth(10, 2500);  // MVC
            sheet.setColumnWidth(11, 2500);  // AVC
            sheet.setColumnWidth(12, 2800);  // Audit VC
            sheet.setColumnWidth(13, 3500);  // Audit remark
            sheet.setColumnWidth(14, 10000); // Audit Desc
            sheet.setColumnWidth(15, 3000);  // Violation Img
            sheet.setColumnWidth(16, 3500);  // NETC Txn Type
            sheet.setColumnWidth(17, 4500);  // Violation API Status

            workbook.write(outputStream);
        }
    }

    public void streamCsvExport(
            LocalDateTime fromDate,
            LocalDateTime toDate,
            String plazaId,
            String auditRemark,
            String apiStatus,
            String vrn,
            String tagId,
            String acqTxnId,
            String tollTxnId,
            OutputStream outputStream) throws Exception {

        Specification<ViolationValidateRecord> spec = buildSpecification(
                fromDate, toDate, plazaId, auditRemark, apiStatus, vrn, tagId, acqTxnId, tollTxnId
        );
        List<ViolationValidateRecord> records = repository.findAll(spec);

        PrintWriter writer = new PrintWriter(outputStream, true, StandardCharsets.UTF_8);
        outputStream.write(new byte[]{(byte) 0xEF, (byte) 0xBB, (byte) 0xBF}); // UTF-8 BOM

        writer.println("# VIOLATION VALIDATE REPORT");
        writer.println("# Date Range: " + (fromDate != null ? fromDate.format(DATE_TIME_FMT) : "Beginning") +
                " to " + (toDate != null ? toDate.format(DATE_TIME_FMT) : "Now"));
        writer.println();

        String[] headers = {
                "Sr No", "Take Action", "Plaza ID", "Plaza Name", "VRN",
                "Tag ID", "Acq Txn ID", "Toll Txn ID", "Txn Amount", "Txn Date Time",
                "MVC", "AVC", "Audit VC", "Audit remark", "Audit Desc",
                "Violation Img", "NETC Txn Type", "Violation API Status"
        };
        writer.println(String.join(",", headers));

        int sr = 1;
        for (ViolationValidateRecord r : records) {
            StringBuilder sb = new StringBuilder();
            sb.append(r.getSrNo() != null ? r.getSrNo() : sr++).append(",");
            sb.append(escapeCsv(r.getTakeAction())).append(",");
            sb.append(escapeCsv(r.getPlazaId())).append(",");
            sb.append(escapeCsv(r.getPlazaName())).append(",");
            sb.append(escapeCsv(r.getVrn())).append(",");
            sb.append(escapeCsv(r.getTagId())).append(",");
            sb.append(escapeCsv(r.getAcqTxnId())).append(",");
            sb.append(escapeCsv(r.getTollTxnId())).append(",");
            sb.append(r.getTxnAmount() != null ? r.getTxnAmount().toPlainString() : "0.00").append(",");
            sb.append(r.getTxnDateTime() != null ? r.getTxnDateTime().format(DATE_TIME_FMT) : "").append(",");
            sb.append(escapeCsv(r.getMvc())).append(",");
            sb.append(escapeCsv(r.getAvc())).append(",");
            sb.append(escapeCsv(r.getAuditVc())).append(",");
            sb.append(escapeCsv(r.getAuditRemark())).append(",");
            sb.append(escapeCsv(r.getAuditDesc())).append(",");
            sb.append(escapeCsv(r.getViolationImg())).append(",");
            sb.append(escapeCsv(r.getNetcTxnType())).append(",");
            sb.append(escapeCsv(r.getViolationApiStatus()));
            writer.println(sb.toString());
        }

        writer.flush();
    }

    private String escapeCsv(String val) {
        if (val == null) return "";
        if (val.contains(",") || val.contains("\"") || val.contains("\n") || val.contains("\r")) {
            return "\"" + val.replace("\"", "\"\"") + "\"";
        }
        return val;
    }

    private Specification<ViolationValidateRecord> buildSpecification(
            LocalDateTime fromDate,
            LocalDateTime toDate,
            String plazaId,
            String auditRemark,
            String apiStatus,
            String vrn,
            String tagId,
            String acqTxnId,
            String tollTxnId) {

        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            if (fromDate != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("txnDateTime"), fromDate));
            }
            if (toDate != null) {
                predicates.add(cb.lessThanOrEqualTo(root.get("txnDateTime"), toDate));
            }
            if (plazaId != null && !plazaId.isBlank() && !"ALL".equalsIgnoreCase(plazaId)) {
                predicates.add(cb.equal(root.get("plazaId"), plazaId));
            }
            if (auditRemark != null && !auditRemark.isBlank() && !"ALL".equalsIgnoreCase(auditRemark)) {
                predicates.add(cb.equal(cb.upper(root.get("auditRemark")), auditRemark.toUpperCase()));
            }
            if (apiStatus != null && !apiStatus.isBlank() && !"ALL".equalsIgnoreCase(apiStatus)) {
                predicates.add(cb.equal(cb.upper(root.get("violationApiStatus")), apiStatus.toUpperCase()));
            }
            if (vrn != null && !vrn.isBlank()) {
                predicates.add(cb.like(cb.upper(root.get("vrn")), "%" + vrn.trim().toUpperCase() + "%"));
            }
            if (tagId != null && !tagId.isBlank()) {
                predicates.add(cb.like(cb.upper(root.get("tagId")), "%" + tagId.trim().toUpperCase() + "%"));
            }
            if (acqTxnId != null && !acqTxnId.isBlank()) {
                predicates.add(cb.like(cb.upper(root.get("acqTxnId")), "%" + acqTxnId.trim().toUpperCase() + "%"));
            }
            if (tollTxnId != null && !tollTxnId.isBlank()) {
                predicates.add(cb.like(cb.upper(root.get("tollTxnId")), "%" + tollTxnId.trim().toUpperCase() + "%"));
            }

            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }
}
