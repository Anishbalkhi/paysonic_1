package com.paysonic.tollops.service;

import com.paysonic.tollops.dto.NhaiTrafficReportDTO;
import com.paysonic.tollops.entity.NhaiTrafficRecord;
import com.paysonic.tollops.repository.NhaiTrafficRepository;
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
public class NhaiTrafficReportService {

    private static final Logger log = LoggerFactory.getLogger(NhaiTrafficReportService.class);
    private final NhaiTrafficRepository repository;

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("dd-MM-yyyy");

    // Standard ordered vehicle classes from NHAI guidelines
    private static final List<String> CLASS_ORDER = List.of(
            "VC4", "VC20", "VC5", "VC6", "VC7", "VC8", "VC9",
            "VC10", "VC11", "VC12", "VC13", "VC14", "VC15", "VC16", "VC17"
    );

    private static final Map<String, String> CLASS_NAMES = Map.ofEntries(
            Map.entry("VC4", "VC4 - Car/Jeep/Van"),
            Map.entry("VC20", "VC20 - Tata Ace or Similar Mini LCV"),
            Map.entry("VC5", "VC5 - Light Commercial vehicle 2-axle"),
            Map.entry("VC6", "VC6 - Light Commercial vehicle 3-axle"),
            Map.entry("VC7", "VC7 - Bus 2-Axle"),
            Map.entry("VC8", "VC8 - Bus 3-Axle"),
            Map.entry("VC9", "VC9 - Mini Bus"),
            Map.entry("VC10", "VC10 - Truck 2-Axle"),
            Map.entry("VC11", "VC11 - Truck 3-Axle"),
            Map.entry("VC12", "VC12 - Truck 4-Axle"),
            Map.entry("VC13", "VC13 - Truck 5-Axle"),
            Map.entry("VC14", "VC14 - Truck 6-Axle"),
            Map.entry("VC15", "VC15 - Truck Multi axle ( 7 and above)"),
            Map.entry("VC16", "VC16 - Earth Moving Machinery"),
            Map.entry("VC17", "VC17 - Heavy Construction Machinery")
    );

    private static final List<String> JOURNEY_TYPES = List.of(
            "Single Journey",
            "Return Journey",
            "DiscountDC",
            "Exempted/ Pass vehicles"
    );

    public NhaiTrafficReportService(NhaiTrafficRepository repository) {
        this.repository = repository;
    }

    public NhaiTrafficReportDTO generateReport(LocalDate fromDate, LocalDate toDate, String plazaCode) {
        if (fromDate == null) fromDate = LocalDate.of(2026, 9, 1);
        if (toDate == null) toDate = LocalDate.of(2026, 9, 30);

        List<NhaiTrafficRecord> rawRecords;
        if (plazaCode != null && !plazaCode.isBlank() && !"ALL".equalsIgnoreCase(plazaCode)) {
            rawRecords = repository.findByPlazaCodeAndReportDateBetweenOrderByDisplayOrderAsc(plazaCode, fromDate, toDate);
        } else {
            rawRecords = repository.findByReportDateBetweenOrderByDisplayOrderAsc(fromDate, toDate);
        }

        String resolvedPlazaCode = (plazaCode != null && !"ALL".equalsIgnoreCase(plazaCode)) ? plazaCode : "All Plazas";
        String resolvedPlazaName = "All Plazas Network";
        if (!rawRecords.isEmpty() && !"ALL".equalsIgnoreCase(plazaCode)) {
            resolvedPlazaName = rawRecords.get(0).getPlazaName();
        } else if ("501101".equals(plazaCode)) {
            resolvedPlazaName = "MUMBAI PLAZA NH-04";
        } else if ("502202".equals(plazaCode)) {
            resolvedPlazaName = "PUNE BYPASS PLAZA";
        } else if ("503303".equals(plazaCode)) {
            resolvedPlazaName = "NASHIK TOLL PLAZA";
        }

        NhaiTrafficReportDTO report = new NhaiTrafficReportDTO();
        report.setPlazaCode(resolvedPlazaCode);
        report.setPlazaName(resolvedPlazaName);
        report.setFromDate(fromDate.format(DATE_FMT));
        report.setToDate(toDate.format(DATE_FMT));

        // Group aggregation map: ClassCode -> JourneyType -> [TollFare, Count, Amount]
        Map<String, Map<String, AggregatedItem>> aggMap = new LinkedHashMap<>();
        for (String vc : CLASS_ORDER) {
            Map<String, AggregatedItem> jMap = new LinkedHashMap<>();
            for (String jt : JOURNEY_TYPES) {
                jMap.put(jt, new AggregatedItem(BigDecimal.ZERO, 0L, BigDecimal.ZERO));
            }
            aggMap.put(vc, jMap);
        }

        for (NhaiTrafficRecord r : rawRecords) {
            String vc = r.getVehicleClassCode();
            String jt = r.getJourneyType();
            if (aggMap.containsKey(vc) && aggMap.get(vc).containsKey(jt)) {
                AggregatedItem item = aggMap.get(vc).get(jt);
                item.count += (r.getTransactionCount() != null ? r.getTransactionCount() : 0L);
                item.amount = item.amount.add(r.getTransactionAmount() != null ? r.getTransactionAmount() : BigDecimal.ZERO);
                if (r.getTollFare() != null && r.getTollFare().compareTo(BigDecimal.ZERO) > 0) {
                    item.fare = r.getTollFare();
                }
            }
        }

        // Build VehicleClassGroups
        int order = 1;
        long totalSingleCount = 0L, totalReturnCount = 0L, totalDiscountCount = 0L, totalExemptCount = 0L;
        BigDecimal totalSingleAmt = BigDecimal.ZERO, totalReturnAmt = BigDecimal.ZERO, totalDiscountAmt = BigDecimal.ZERO, totalExemptAmt = BigDecimal.ZERO;

        for (String vc : CLASS_ORDER) {
            String vcName = CLASS_NAMES.getOrDefault(vc, vc);
            NhaiTrafficReportDTO.VehicleClassGroup group = new NhaiTrafficReportDTO.VehicleClassGroup(vc, vcName, order++);

            Map<String, AggregatedItem> jMap = aggMap.get(vc);
            for (String jt : JOURNEY_TYPES) {
                AggregatedItem item = jMap.get(jt);
                group.getJourneys().add(new NhaiTrafficReportDTO.JourneyRow(
                        jt, item.fare, item.count, item.amount
                ));

                // Accumulate journey totals
                switch (jt) {
                    case "Single Journey":
                        totalSingleCount += item.count;
                        totalSingleAmt = totalSingleAmt.add(item.amount);
                        break;
                    case "Return Journey":
                        totalReturnCount += item.count;
                        totalReturnAmt = totalReturnAmt.add(item.amount);
                        break;
                    case "DiscountDC":
                        totalDiscountCount += item.count;
                        totalDiscountAmt = totalDiscountAmt.add(item.amount);
                        break;
                    case "Exempted/ Pass vehicles":
                        totalExemptCount += item.count;
                        totalExemptAmt = totalExemptAmt.add(item.amount);
                        break;
                }
            }
            report.getVehicleClasses().add(group);
        }

        // Add Journey Totals
        report.getJourneyTotals().add(new NhaiTrafficReportDTO.JourneyTotalItem("Total Single Journey", totalSingleCount, totalSingleAmt));
        report.getJourneyTotals().add(new NhaiTrafficReportDTO.JourneyTotalItem("Total Return Journey", totalReturnCount, totalReturnAmt));
        report.getJourneyTotals().add(new NhaiTrafficReportDTO.JourneyTotalItem("Total DiscountDC", totalDiscountCount, totalDiscountAmt));
        report.getJourneyTotals().add(new NhaiTrafficReportDTO.JourneyTotalItem("Total Exempted/ Pass vehicles", totalExemptCount, totalExemptAmt));

        // Add Grand Total
        long grandTotalCount = totalSingleCount + totalReturnCount + totalDiscountCount + totalExemptCount;
        BigDecimal grandTotalAmount = totalSingleAmt.add(totalReturnAmt).add(totalDiscountAmt).add(totalExemptAmt);
        report.setGrandTotal(new NhaiTrafficReportDTO.GrandTotalItem(grandTotalCount, grandTotalAmount));

        return report;
    }

    public void streamExcelExport(LocalDate fromDate, LocalDate toDate, String plazaCode, OutputStream outputStream) throws Exception {
        NhaiTrafficReportDTO report = generateReport(fromDate, toDate, plazaCode);

        try (SXSSFWorkbook workbook = new SXSSFWorkbook(100)) {
            Sheet sheet = workbook.createSheet("NHAI Traffic Report");
            DataFormat dataFormat = workbook.createDataFormat();

            // Title Style (Red / Maroon Bold 16pt as in NHAI screenshot)
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

            // Header Style (Maroon Header Background)
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
            amountStyle.setDataFormat(dataFormat.getFormat("#,##0.00"));
            amountStyle.setAlignment(HorizontalAlignment.RIGHT);
            amountStyle.setVerticalAlignment(VerticalAlignment.CENTER);
            applyBorders(amountStyle);

            CellStyle countStyle = workbook.createCellStyle();
            countStyle.setDataFormat(dataFormat.getFormat("#,##0"));
            countStyle.setAlignment(HorizontalAlignment.RIGHT);
            countStyle.setVerticalAlignment(VerticalAlignment.CENTER);
            applyBorders(countStyle);

            // Highlight / Totals Style
            CellStyle yellowTotalStyle = workbook.createCellStyle();
            Font totalFont = workbook.createFont();
            totalFont.setFontName("Calibri");
            totalFont.setBold(true);
            yellowTotalStyle.setFont(totalFont);
            yellowTotalStyle.setFillForegroundColor(IndexedColors.LIGHT_YELLOW.getIndex());
            yellowTotalStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            applyBorders(yellowTotalStyle);

            CellStyle yellowCountStyle = workbook.createCellStyle();
            yellowCountStyle.cloneStyleFrom(yellowTotalStyle);
            yellowCountStyle.setDataFormat(dataFormat.getFormat("#,##0"));
            yellowCountStyle.setAlignment(HorizontalAlignment.RIGHT);

            CellStyle yellowAmtStyle = workbook.createCellStyle();
            yellowAmtStyle.cloneStyleFrom(yellowTotalStyle);
            yellowAmtStyle.setDataFormat(dataFormat.getFormat("#,##0.00"));
            yellowAmtStyle.setAlignment(HorizontalAlignment.RIGHT);

            int rowIdx = 0;

            // Row 0: Title Banner
            Row titleRow = sheet.createRow(rowIdx++);
            titleRow.setHeightInPoints(28);
            Cell titleCell = titleRow.createCell(0);
            titleCell.setCellValue("NHAI Traffic Report");
            titleCell.setCellStyle(titleStyle);
            sheet.addMergedRegion(new CellRangeAddress(0, 0, 0, 6));

            // Row 1: Subtitle
            Row subTitleRow = sheet.createRow(rowIdx++);
            subTitleRow.setHeightInPoints(18);
            Cell subTitleCell = subTitleRow.createCell(0);
            DateTimeFormatter dtf = DateTimeFormatter.ofPattern("dd-MM-yyyy HH:mm:ss");
            subTitleCell.setCellValue("From Date: " + report.getFromDate() + "   |   To Date: " + report.getToDate() + "   |   Report Fetch Time: " + LocalDateTime.now().format(dtf));
            subTitleCell.setCellStyle(subTitleStyle);
            sheet.addMergedRegion(new CellRangeAddress(1, 1, 0, 6));

            rowIdx++; // Empty spacing row

            // Table Headers
            String[] headers = {
                    "Plaza Code", "Plaza Name", "Vehicle Class", "Journey Type",
                    "Toll Fare", "Transaction Count", "Transaction Amount"
            };

            Row headerRow = sheet.createRow(rowIdx++);
            headerRow.setHeightInPoints(24);
            for (int i = 0; i < headers.length; i++) {
                Cell c = headerRow.createCell(i);
                c.setCellValue(headers[i]);
                c.setCellStyle(headerStyle);
            }

            int tableDataStartRow = rowIdx;

            // Iterate over each vehicle class group
            for (NhaiTrafficReportDTO.VehicleClassGroup group : report.getVehicleClasses()) {
                int groupStartRow = rowIdx;

                for (NhaiTrafficReportDTO.JourneyRow journey : group.getJourneys()) {
                    Row row = sheet.createRow(rowIdx++);
                    row.setHeightInPoints(18);

                    // Col 0: Plaza Code
                    Cell c0 = row.createCell(0);
                    c0.setCellValue(report.getPlazaCode());
                    c0.setCellStyle(centerStyle);

                    // Col 1: Plaza Name
                    Cell c1 = row.createCell(1);
                    c1.setCellValue(report.getPlazaName());
                    c1.setCellStyle(textStyle);

                    // Col 2: Vehicle Class
                    Cell c2 = row.createCell(2);
                    c2.setCellValue(group.getClassName());
                    c2.setCellStyle(textStyle);

                    // Col 3: Journey Type
                    Cell c3 = row.createCell(3);
                    c3.setCellValue(journey.getJourneyType());
                    c3.setCellStyle(textStyle);

                    // Col 4: Toll Fare
                    Cell c4 = row.createCell(4);
                    c4.setCellValue(journey.getTollFare() != null ? journey.getTollFare().doubleValue() : 0.0);
                    c4.setCellStyle(amountStyle);

                    // Col 5: Transaction Count
                    Cell c5 = row.createCell(5);
                    c5.setCellValue(journey.getTransactionCount() != null ? journey.getTransactionCount() : 0);
                    c5.setCellStyle(countStyle);

                    // Col 6: Transaction Amount
                    Cell c6 = row.createCell(6);
                    c6.setCellValue(journey.getTransactionAmount() != null ? journey.getTransactionAmount().doubleValue() : 0.0);
                    c6.setCellStyle(amountStyle);
                }

                // Merge Vehicle Class across 4 rows
                sheet.addMergedRegion(new CellRangeAddress(groupStartRow, rowIdx - 1, 2, 2));
            }

            // Merge Plaza Code and Plaza Name across all vehicle class rows
            if (rowIdx > tableDataStartRow) {
                sheet.addMergedRegion(new CellRangeAddress(tableDataStartRow, rowIdx - 1, 0, 0));
                sheet.addMergedRegion(new CellRangeAddress(tableDataStartRow, rowIdx - 1, 1, 1));
            }

            // ── Journey Totals Block ──
            int journeyTotalStartRow = rowIdx;
            for (NhaiTrafficReportDTO.JourneyTotalItem jTotal : report.getJourneyTotals()) {
                Row row = sheet.createRow(rowIdx++);
                row.setHeightInPoints(18);

                // Col 0: Empty
                Cell c0 = row.createCell(0);
                c0.setCellStyle(centerStyle);

                // Col 1: Empty
                Cell c1 = row.createCell(1);
                c1.setCellStyle(textStyle);

                // Col 2: Journey Total label (will merge)
                Cell c2 = row.createCell(2);
                c2.setCellValue("Journey Total");
                c2.setCellStyle(yellowTotalStyle);

                // Col 3: Specific Journey Total label
                Cell c3 = row.createCell(3);
                c3.setCellValue(jTotal.getJourneyType());
                c3.setCellStyle(yellowTotalStyle);

                // Col 4: Empty Toll Fare
                Cell c4 = row.createCell(4);
                c4.setCellStyle(yellowTotalStyle);

                // Col 5: Total Count
                Cell c5 = row.createCell(5);
                c5.setCellValue(jTotal.getTransactionCount() != null ? jTotal.getTransactionCount() : 0);
                c5.setCellStyle(yellowCountStyle);

                // Col 6: Total Amount
                Cell c6 = row.createCell(6);
                c6.setCellValue(jTotal.getTransactionAmount() != null ? jTotal.getTransactionAmount().doubleValue() : 0.0);
                c6.setCellStyle(yellowAmtStyle);
            }

            // Merge "Journey Total" cell across its 4 total rows
            sheet.addMergedRegion(new CellRangeAddress(journeyTotalStartRow, rowIdx - 1, 2, 2));

            // ── Grand Total Row ──
            Row grandRow = sheet.createRow(rowIdx++);
            grandRow.setHeightInPoints(22);

            Cell gc0 = grandRow.createCell(0);
            gc0.setCellStyle(centerStyle);

            Cell gc1 = grandRow.createCell(1);
            gc1.setCellStyle(textStyle);

            Cell gc2 = grandRow.createCell(2);
            gc2.setCellValue("Grand Total");
            gc2.setCellStyle(yellowTotalStyle);

            Cell gc3 = grandRow.createCell(3);
            gc3.setCellStyle(yellowTotalStyle);

            Cell gc4 = grandRow.createCell(4);
            gc4.setCellStyle(yellowTotalStyle);

            Cell gc5 = grandRow.createCell(5);
            gc5.setCellValue(report.getGrandTotal().getTotalCount() != null ? report.getGrandTotal().getTotalCount() : 0);
            gc5.setCellStyle(yellowCountStyle);

            Cell gc6 = grandRow.createCell(6);
            gc6.setCellValue(report.getGrandTotal().getTotalAmount() != null ? report.getGrandTotal().getTotalAmount().doubleValue() : 0.0);
            gc6.setCellStyle(yellowAmtStyle);

            sheet.addMergedRegion(new CellRangeAddress(grandRow.getRowNum(), grandRow.getRowNum(), 2, 4));

            // Column Widths
            sheet.setColumnWidth(0, 3500);  // Plaza Code
            sheet.setColumnWidth(1, 6500);  // Plaza Name
            sheet.setColumnWidth(2, 9000);  // Vehicle Class
            sheet.setColumnWidth(3, 7000);  // Journey Type
            sheet.setColumnWidth(4, 3500);  // Toll Fare
            sheet.setColumnWidth(5, 5500);  // Transaction Count
            sheet.setColumnWidth(6, 6000);  // Transaction Amount

            workbook.write(outputStream);
        }
    }

    public void streamCsvExport(LocalDate fromDate, LocalDate toDate, String plazaCode, OutputStream outputStream) throws Exception {
        NhaiTrafficReportDTO report = generateReport(fromDate, toDate, plazaCode);

        PrintWriter writer = new PrintWriter(outputStream, true, StandardCharsets.UTF_8);
        outputStream.write(new byte[]{(byte) 0xEF, (byte) 0xBB, (byte) 0xBF}); // UTF-8 BOM

        DateTimeFormatter dtf = DateTimeFormatter.ofPattern("dd-MM-yyyy HH:mm:ss");
        writer.println("# NHAI Traffic Report");
        writer.println("# From Date: " + report.getFromDate() + "   |   To Date: " + report.getToDate() + "   |   Report Fetch Time: " + LocalDateTime.now().format(dtf));
        writer.println("# Plaza Code: " + report.getPlazaCode() + " Plaza Name: " + report.getPlazaName());
        writer.println();

        String[] headers = {
                "Plaza Code", "Plaza Name", "Vehicle Class", "Journey Type",
                "Toll Fare", "Transaction Count", "Transaction Amount"
        };
        writer.println(String.join(",", headers));

        for (NhaiTrafficReportDTO.VehicleClassGroup group : report.getVehicleClasses()) {
            for (NhaiTrafficReportDTO.JourneyRow journey : group.getJourneys()) {
                StringBuilder sb = new StringBuilder();
                sb.append(escapeCsv(report.getPlazaCode())).append(",");
                sb.append(escapeCsv(report.getPlazaName())).append(",");
                sb.append(escapeCsv(group.getClassName())).append(",");
                sb.append(escapeCsv(journey.getJourneyType())).append(",");
                sb.append(journey.getTollFare() != null ? journey.getTollFare().toPlainString() : "0.00").append(",");
                sb.append(journey.getTransactionCount() != null ? journey.getTransactionCount() : 0).append(",");
                sb.append(journey.getTransactionAmount() != null ? journey.getTransactionAmount().toPlainString() : "0.00");
                writer.println(sb.toString());
            }
        }

        // Journey Totals
        for (NhaiTrafficReportDTO.JourneyTotalItem jt : report.getJourneyTotals()) {
            StringBuilder sb = new StringBuilder();
            sb.append(",,\"Journey Total\",");
            sb.append(escapeCsv(jt.getJourneyType())).append(",");
            sb.append(",");
            sb.append(jt.getTransactionCount() != null ? jt.getTransactionCount() : 0).append(",");
            sb.append(jt.getTransactionAmount() != null ? jt.getTransactionAmount().toPlainString() : "0.00");
            writer.println(sb.toString());
        }

        // Grand Total
        StringBuilder gt = new StringBuilder();
        gt.append(",,\"Grand Total\",,,");
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

    private static class AggregatedItem {
        BigDecimal fare;
        long count;
        BigDecimal amount;

        AggregatedItem(BigDecimal fare, long count, BigDecimal amount) {
            this.fare = fare;
            this.count = count;
            this.amount = amount;
        }
    }
}
