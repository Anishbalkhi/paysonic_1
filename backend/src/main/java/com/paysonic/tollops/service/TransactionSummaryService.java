package com.paysonic.tollops.service;

import com.paysonic.tollops.dto.TransactionSummaryResponseDTO;
import com.paysonic.tollops.entity.TransactionSummaryRecord;
import com.paysonic.tollops.repository.TransactionSummaryRepository;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.streaming.SXSSFWorkbook;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.OutputStream;
import java.io.PrintWriter;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
public class TransactionSummaryService {

    private static final Logger log = LoggerFactory.getLogger(TransactionSummaryService.class);
    private final TransactionSummaryRepository repository;

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("dd-MM-yyyy");

    private static final List<String> STATUS_ORDER = List.of("Declined", "NPCIDecline", "Accepted");

    public TransactionSummaryService(TransactionSummaryRepository repository) {
        this.repository = repository;
    }

    public TransactionSummaryResponseDTO generateReport(LocalDate fromDate, LocalDate toDate, String plazaId, String statusFilter) {
        if (fromDate == null) fromDate = LocalDate.of(2026, 9, 1);
        if (toDate == null) toDate = LocalDate.of(2026, 9, 30);

        List<TransactionSummaryRecord> rawList;
        if (plazaId != null && !plazaId.isBlank() && !"ALL".equalsIgnoreCase(plazaId)) {
            rawList = repository.findByPlazaIdAndReportDateBetweenOrderByDisplayOrderAsc(plazaId, fromDate, toDate);
            if (rawList == null || rawList.isEmpty()) {
                rawList = repository.findByPlazaIdOrderByDisplayOrderAsc(plazaId);
            }
        } else {
            rawList = repository.findByReportDateBetweenOrderByDisplayOrderAsc(fromDate, toDate);
            if (rawList == null || rawList.isEmpty()) {
                rawList = repository.findAllByOrderByDisplayOrderAsc();
            }
        }

        TransactionSummaryResponseDTO response = new TransactionSummaryResponseDTO();
        response.setFromDate(fromDate.format(DATE_FMT));
        response.setToDate(toDate.format(DATE_FMT));
        response.setSelectedPlaza(plazaId != null && !plazaId.isBlank() ? plazaId : "ALL");

        // Group by Plaza -> Status -> List of Records
        Map<String, Map<String, List<TransactionSummaryRecord>>> plazaMap = new LinkedHashMap<>();
        Map<String, String> plazaNames = new HashMap<>();

        for (TransactionSummaryRecord r : rawList) {
            if (statusFilter != null && !statusFilter.isBlank() && !"ALL".equalsIgnoreCase(statusFilter)) {
                if (!statusFilter.equalsIgnoreCase(r.getTransactionStatus())) {
                    continue;
                }
            }

            plazaMap.putIfAbsent(r.getPlazaId(), new LinkedHashMap<>());
            plazaNames.putIfAbsent(r.getPlazaId(), r.getPlazaName());

            Map<String, List<TransactionSummaryRecord>> statusMap = plazaMap.get(r.getPlazaId());
            statusMap.putIfAbsent(r.getTransactionStatus(), new ArrayList<>());
            statusMap.get(r.getTransactionStatus()).add(r);
        }

        long grandTotalCount = 0L;
        BigDecimal grandTotalAmount = BigDecimal.ZERO;
        long acceptedCount = 0L;
        BigDecimal acceptedAmount = BigDecimal.ZERO;
        long declinedCount = 0L;
        BigDecimal declinedAmount = BigDecimal.ZERO;

        for (Map.Entry<String, Map<String, List<TransactionSummaryRecord>>> pEntry : plazaMap.entrySet()) {
            String pId = pEntry.getKey();
            String pName = plazaNames.getOrDefault(pId, "Plaza Name");
            TransactionSummaryResponseDTO.PlazaSummaryGroup plazaGroup =
                    new TransactionSummaryResponseDTO.PlazaSummaryGroup(pId, pName);

            long pCount = 0L;
            BigDecimal pAmount = BigDecimal.ZERO;

            for (String st : STATUS_ORDER) {
                if (!pEntry.getValue().containsKey(st)) continue;
                List<TransactionSummaryRecord> records = pEntry.getValue().get(st);

                TransactionSummaryResponseDTO.StatusGroup statusGroup =
                        new TransactionSummaryResponseDTO.StatusGroup(st);

                Map<String, TransactionSummaryResponseDTO.ResponseCodeRow> rowMap = new LinkedHashMap<>();
                long subCount = 0L;
                BigDecimal subAmount = BigDecimal.ZERO;

                for (TransactionSummaryRecord rec : records) {
                    long c = rec.getTransactionCount() != null ? rec.getTransactionCount() : 0L;
                    BigDecimal a = rec.getTransactionAmount() != null ? rec.getTransactionAmount() : BigDecimal.ZERO;
                    String code = rec.getResponseCode() != null ? rec.getResponseCode().trim() : "UNKNOWN";

                    if (!rowMap.containsKey(code)) {
                        rowMap.put(code, new TransactionSummaryResponseDTO.ResponseCodeRow(code, c, a));
                        subCount += c;
                        subAmount = subAmount.add(a);
                    }
                }

                statusGroup.setRows(new ArrayList<>(rowMap.values()));
                statusGroup.setSubtotalCount(subCount);
                statusGroup.setSubtotalAmount(subAmount);
                plazaGroup.getStatusGroups().add(statusGroup);

                pCount += subCount;
                pAmount = pAmount.add(subAmount);

                if ("Accepted".equalsIgnoreCase(st)) {
                    acceptedCount += subCount;
                    acceptedAmount = acceptedAmount.add(subAmount);
                } else {
                    declinedCount += subCount;
                    declinedAmount = declinedAmount.add(subAmount);
                }
            }

            plazaGroup.setPlazaTotalCount(pCount);
            plazaGroup.setPlazaTotalAmount(pAmount);
            response.getPlazas().add(plazaGroup);

            grandTotalCount += pCount;
            grandTotalAmount = grandTotalAmount.add(pAmount);
        }

        TransactionSummaryResponseDTO.OverallGrandTotal grand =
                new TransactionSummaryResponseDTO.OverallGrandTotal();
        grand.setTotalCount(grandTotalCount);
        grand.setTotalAmount(grandTotalAmount);
        grand.setAcceptedCount(acceptedCount);
        grand.setAcceptedAmount(acceptedAmount);
        grand.setDeclinedCount(declinedCount);
        grand.setDeclinedAmount(declinedAmount);
        response.setGrandTotal(grand);

        return response;
    }

    public void streamExcelExport(LocalDate fromDate, LocalDate toDate, String plazaId, String statusFilter, OutputStream outputStream) throws Exception {
        TransactionSummaryResponseDTO report = generateReport(fromDate, toDate, plazaId, statusFilter);

        try (SXSSFWorkbook workbook = new SXSSFWorkbook(100)) {
            Sheet sheet = workbook.createSheet("Transaction Summary Report");
            DataFormat dataFormat = workbook.createDataFormat();

            // Title Style (Maroon Bold 16pt)
            CellStyle titleStyle = workbook.createCellStyle();
            Font titleFont = workbook.createFont();
            titleFont.setFontName("Calibri");
            titleFont.setFontHeightInPoints((short) 16);
            titleFont.setBold(true);
            titleFont.setColor(IndexedColors.DARK_RED.getIndex());
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

            // Header Style (Maroon Header Background with White Text)
            CellStyle headerStyle = workbook.createCellStyle();
            Font headerFont = workbook.createFont();
            headerFont.setFontName("Calibri");
            headerFont.setFontHeightInPoints((short) 11);
            headerFont.setBold(true);
            headerFont.setColor(IndexedColors.WHITE.getIndex());
            headerStyle.setFont(headerFont);
            headerStyle.setFillForegroundColor(IndexedColors.DARK_RED.getIndex());
            headerStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            headerStyle.setAlignment(HorizontalAlignment.CENTER);
            headerStyle.setVerticalAlignment(VerticalAlignment.CENTER);
            headerStyle.setBorderBottom(BorderStyle.THIN);
            headerStyle.setBorderTop(BorderStyle.THIN);
            headerStyle.setBorderLeft(BorderStyle.THIN);
            headerStyle.setBorderRight(BorderStyle.THIN);

            // Standard Data Cell Styles
            CellStyle textStyle = workbook.createCellStyle();
            textStyle.setAlignment(HorizontalAlignment.LEFT);
            textStyle.setVerticalAlignment(VerticalAlignment.CENTER);
            applyBorders(textStyle);

            CellStyle centerStyle = workbook.createCellStyle();
            centerStyle.setAlignment(HorizontalAlignment.CENTER);
            centerStyle.setVerticalAlignment(VerticalAlignment.CENTER);
            applyBorders(centerStyle);

            CellStyle amountStyle = workbook.createCellStyle();
            amountStyle.setDataFormat(dataFormat.getFormat("₹ #,##0.00"));
            amountStyle.setAlignment(HorizontalAlignment.RIGHT);
            amountStyle.setVerticalAlignment(VerticalAlignment.CENTER);
            applyBorders(amountStyle);

            CellStyle countStyle = workbook.createCellStyle();
            countStyle.setDataFormat(dataFormat.getFormat("#,##0"));
            countStyle.setAlignment(HorizontalAlignment.RIGHT);
            countStyle.setVerticalAlignment(VerticalAlignment.CENTER);
            applyBorders(countStyle);

            // Subtotal Style
            CellStyle subtotalStyle = workbook.createCellStyle();
            Font subtotalFont = workbook.createFont();
            subtotalFont.setFontName("Calibri");
            subtotalFont.setBold(true);
            subtotalStyle.setFont(subtotalFont);
            subtotalStyle.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
            subtotalStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            applyBorders(subtotalStyle);

            CellStyle subtotalAmtStyle = workbook.createCellStyle();
            subtotalAmtStyle.cloneStyleFrom(subtotalStyle);
            subtotalAmtStyle.setDataFormat(dataFormat.getFormat("₹ #,##0.00"));
            subtotalAmtStyle.setAlignment(HorizontalAlignment.RIGHT);

            CellStyle subtotalCountStyle = workbook.createCellStyle();
            subtotalCountStyle.cloneStyleFrom(subtotalStyle);
            subtotalCountStyle.setDataFormat(dataFormat.getFormat("#,##0"));
            subtotalCountStyle.setAlignment(HorizontalAlignment.RIGHT);

            // Grand Total Style
            CellStyle grandStyle = workbook.createCellStyle();
            Font grandFont = workbook.createFont();
            grandFont.setFontName("Calibri");
            grandFont.setBold(true);
            grandStyle.setFont(grandFont);
            grandStyle.setFillForegroundColor(IndexedColors.LIGHT_YELLOW.getIndex());
            grandStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            applyBorders(grandStyle);

            CellStyle grandAmtStyle = workbook.createCellStyle();
            grandAmtStyle.cloneStyleFrom(grandStyle);
            grandAmtStyle.setDataFormat(dataFormat.getFormat("₹ #,##0.00"));
            grandAmtStyle.setAlignment(HorizontalAlignment.RIGHT);

            CellStyle grandCountStyle = workbook.createCellStyle();
            grandCountStyle.cloneStyleFrom(grandStyle);
            grandCountStyle.setDataFormat(dataFormat.getFormat("#,##0"));
            grandCountStyle.setAlignment(HorizontalAlignment.RIGHT);

            int rowIdx = 0;

            // Row 0: Title Banner
            Row titleRow = sheet.createRow(rowIdx++);
            titleRow.setHeightInPoints(28);
            Cell titleCell = titleRow.createCell(0);
            titleCell.setCellValue("Transaction Summary Report");
            titleCell.setCellStyle(titleStyle);
            sheet.addMergedRegion(new CellRangeAddress(0, 0, 0, 5));

            // Row 1: Subtitle
            Row subTitleRow = sheet.createRow(rowIdx++);
            subTitleRow.setHeightInPoints(18);
            Cell subTitleCell = subTitleRow.createCell(0);
            subTitleCell.setCellValue("From Date: " + report.getFromDate() + "    To Date: " + report.getToDate());
            subTitleCell.setCellStyle(subTitleStyle);
            sheet.addMergedRegion(new CellRangeAddress(1, 1, 0, 5));

            rowIdx++; // Empty spacing row

            // Table Headers (6 columns)
            String[] headers = {
                    "Plaza Id", "Plaza Name", "Transaction Status", "Response Code",
                    "Transaction Count", "Transaction Amount"
            };

            Row headerRow = sheet.createRow(rowIdx++);
            headerRow.setHeightInPoints(24);
            for (int i = 0; i < headers.length; i++) {
                Cell c = headerRow.createCell(i);
                c.setCellValue(headers[i]);
                c.setCellStyle(headerStyle);
            }

            for (TransactionSummaryResponseDTO.PlazaSummaryGroup plaza : report.getPlazas()) {
                int plazaStartRow = rowIdx;

                for (TransactionSummaryResponseDTO.StatusGroup sg : plaza.getStatusGroups()) {
                    int statusStartRow = rowIdx;

                    for (TransactionSummaryResponseDTO.ResponseCodeRow r : sg.getRows()) {
                        Row row = sheet.createRow(rowIdx++);
                        row.setHeightInPoints(18);

                        // 0: Plaza Id
                        Cell c0 = row.createCell(0);
                        c0.setCellValue(plaza.getPlazaId());
                        c0.setCellStyle(centerStyle);

                        // 1: Plaza Name
                        Cell c1 = row.createCell(1);
                        c1.setCellValue(plaza.getPlazaName());
                        c1.setCellStyle(textStyle);

                        // 2: Transaction Status
                        Cell c2 = row.createCell(2);
                        c2.setCellValue(sg.getTransactionStatus());
                        c2.setCellStyle(centerStyle);

                        // 3: Response Code
                        Cell c3 = row.createCell(3);
                        c3.setCellValue(r.getResponseCode());
                        c3.setCellStyle(centerStyle);

                        // 4: Transaction Count
                        Cell c4 = row.createCell(4);
                        c4.setCellValue(r.getTransactionCount() != null ? r.getTransactionCount() : 0);
                        c4.setCellStyle(countStyle);

                        // 5: Transaction Amount
                        Cell c5 = row.createCell(5);
                        c5.setCellValue(r.getTransactionAmount() != null ? r.getTransactionAmount().doubleValue() : 0.0);
                        c5.setCellStyle(amountStyle);
                    }

                    // Merge Status column across its rows
                    if (rowIdx - 1 > statusStartRow) {
                        sheet.addMergedRegion(new CellRangeAddress(statusStartRow, rowIdx - 1, 2, 2));
                    }
                }

                // Merge Plaza Id & Plaza Name columns across all rows in this plaza
                if (rowIdx - 1 > plazaStartRow) {
                    sheet.addMergedRegion(new CellRangeAddress(plazaStartRow, rowIdx - 1, 0, 0));
                    sheet.addMergedRegion(new CellRangeAddress(plazaStartRow, rowIdx - 1, 1, 1));
                }
            }

            // ── Grand Total Row ──
            Row grandRow = sheet.createRow(rowIdx++);
            grandRow.setHeightInPoints(22);

            Cell gc0 = grandRow.createCell(0);
            gc0.setCellValue("Grand Total");
            gc0.setCellStyle(grandStyle);

            Cell gc1 = grandRow.createCell(1);
            gc1.setCellStyle(grandStyle);

            Cell gc2 = grandRow.createCell(2);
            gc2.setCellStyle(grandStyle);

            Cell gc3 = grandRow.createCell(3);
            gc3.setCellStyle(grandStyle);

            Cell gc4 = grandRow.createCell(4);
            gc4.setCellValue(report.getGrandTotal().getTotalCount() != null ? report.getGrandTotal().getTotalCount() : 0);
            gc4.setCellStyle(grandCountStyle);

            Cell gc5 = grandRow.createCell(5);
            gc5.setCellValue(report.getGrandTotal().getTotalAmount() != null ? report.getGrandTotal().getTotalAmount().doubleValue() : 0.0);
            gc5.setCellStyle(grandAmtStyle);

            sheet.addMergedRegion(new CellRangeAddress(grandRow.getRowNum(), grandRow.getRowNum(), 0, 3));

            // Column Widths
            sheet.setColumnWidth(0, 4500);  // Plaza Id
            sheet.setColumnWidth(1, 6500);  // Plaza Name
            sheet.setColumnWidth(2, 5500);  // Transaction Status
            sheet.setColumnWidth(3, 5500);  // Response Code
            sheet.setColumnWidth(4, 5500);  // Transaction Count
            sheet.setColumnWidth(5, 6500);  // Transaction Amount

            workbook.write(outputStream);
        }
    }

    public void streamCsvExport(LocalDate fromDate, LocalDate toDate, String plazaId, String statusFilter, OutputStream outputStream) throws Exception {
        TransactionSummaryResponseDTO report = generateReport(fromDate, toDate, plazaId, statusFilter);

        PrintWriter writer = new PrintWriter(outputStream, true, StandardCharsets.UTF_8);
        outputStream.write(new byte[]{(byte) 0xEF, (byte) 0xBB, (byte) 0xBF}); // UTF-8 BOM

        writer.println("# Transaction Summary Report");
        writer.println("# From Date: " + report.getFromDate() + " To Date: " + report.getToDate());
        writer.println();

        String[] headers = {
                "Plaza Id", "Plaza Name", "Transaction Status", "Response Code",
                "Transaction Count", "Transaction Amount"
        };
        writer.println(String.join(",", headers));

        for (TransactionSummaryResponseDTO.PlazaSummaryGroup plaza : report.getPlazas()) {
            for (TransactionSummaryResponseDTO.StatusGroup sg : plaza.getStatusGroups()) {
                for (TransactionSummaryResponseDTO.ResponseCodeRow r : sg.getRows()) {
                    StringBuilder sb = new StringBuilder();
                    sb.append(escapeCsv(plaza.getPlazaId())).append(",");
                    sb.append(escapeCsv(plaza.getPlazaName())).append(",");
                    sb.append(escapeCsv(sg.getTransactionStatus())).append(",");
                    sb.append(escapeCsv(r.getResponseCode())).append(",");
                    sb.append(r.getTransactionCount() != null ? r.getTransactionCount() : 0).append(",");
                    sb.append(r.getTransactionAmount() != null ? r.getTransactionAmount().toPlainString() : "0.00");
                    writer.println(sb.toString());
                }
            }
        }

        // Grand Total row
        StringBuilder gt = new StringBuilder();
        gt.append("\"Grand Total\",,,,");
        gt.append(report.getGrandTotal().getTotalCount() != null ? report.getGrandTotal().getTotalCount() : 0).append(",");
        gt.append(report.getGrandTotal().getTotalAmount() != null ? report.getGrandTotal().getTotalAmount().toPlainString() : "0.00");
        writer.println(gt.toString());

        writer.flush();
    }

    private String escapeCsv(String val) {
        if (val == null) return "";
        if (val.contains(",") || val.contains("\"") || val.contains("\n") || val.contains("\r")) {
            return "\"" + val.replace("\"", "\"\"") + "\"";
        }
        return val;
    }

    private void applyBorders(CellStyle style) {
        style.setBorderBottom(BorderStyle.THIN);
        style.setBorderTop(BorderStyle.THIN);
        style.setBorderLeft(BorderStyle.THIN);
        style.setBorderRight(BorderStyle.THIN);
        style.setBottomBorderColor(IndexedColors.GREY_25_PERCENT.getIndex());
        style.setTopBorderColor(IndexedColors.GREY_25_PERCENT.getIndex());
        style.setLeftBorderColor(IndexedColors.GREY_25_PERCENT.getIndex());
        style.setRightBorderColor(IndexedColors.GREY_25_PERCENT.getIndex());
    }
}
