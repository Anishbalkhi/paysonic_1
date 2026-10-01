package com.paysonic.tollops.service;

import com.paysonic.tollops.dto.PassSummaryResponseDTO;
import com.paysonic.tollops.entity.PassSummaryRecord;
import com.paysonic.tollops.repository.PassSummaryRepository;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.streaming.SXSSFWorkbook;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class PassSummaryService {

    private final PassSummaryRepository passRepo;
    private static final List<String> PASS_TYPES_ORDER =
            Arrays.asList("Monthly Regular", "Monthly Exempted", "Local 10km", "Local 20km");
    private static final List<String> MODE_ORDER = Arrays.asList("Cash", "Online");

    public PassSummaryService(PassSummaryRepository passRepo) {
        this.passRepo = passRepo;
    }

    // ── Search / Aggregate ───────────────────────────────────────────────

    public List<PassSummaryResponseDTO> getReport(String plazaId, LocalDate fromDate, LocalDate toDate) {
        List<PassSummaryRecord> records = passRepo.findByFilters(
                (plazaId == null || plazaId.isBlank() ? "ALL" : plazaId),
                fromDate, toDate);

        // Group by Plaza
        Map<String, List<PassSummaryRecord>> byPlaza = new LinkedHashMap<>();
        for (PassSummaryRecord r : records) {
            byPlaza.computeIfAbsent(r.getPlazaId(), k -> new ArrayList<>()).add(r);
        }

        List<PassSummaryResponseDTO> result = new ArrayList<>();
        for (Map.Entry<String, List<PassSummaryRecord>> entry : byPlaza.entrySet()) {
            List<PassSummaryRecord> plazaRecs = entry.getValue();
            PassSummaryResponseDTO dto = new PassSummaryResponseDTO();
            dto.setPlazaId(plazaRecs.get(0).getPlazaId());
            dto.setPlazaName(plazaRecs.get(0).getPlazaName());

            // Group by payment mode
            Map<String, List<PassSummaryRecord>> byMode = new LinkedHashMap<>();
            for (PassSummaryRecord r : plazaRecs) {
                byMode.computeIfAbsent(r.getPaymentMode(), k -> new ArrayList<>()).add(r);
            }

            List<PassSummaryResponseDTO.PaymentModeGroup> modeGroups = new ArrayList<>();
            long grandCount = 0;
            BigDecimal grandAmount = BigDecimal.ZERO;

            for (String mode : MODE_ORDER) {
                List<PassSummaryRecord> modeRecs = byMode.getOrDefault(mode, Collections.emptyList());

                // Build map by pass type for quick lookup
                Map<String, PassSummaryRecord> byType = modeRecs.stream()
                        .collect(Collectors.toMap(PassSummaryRecord::getPassType, r -> r, (a, b) -> a));

                List<PassSummaryResponseDTO.PassTypeRow> rows = new ArrayList<>();
                long modeTotal = 0;
                BigDecimal modeAmt = BigDecimal.ZERO;

                for (String pt : PASS_TYPES_ORDER) {
                    PassSummaryRecord rec = byType.get(pt);
                    long cnt = rec != null ? rec.getPassCount() : 0;
                    BigDecimal amt = rec != null ? rec.getPassAmount() : BigDecimal.ZERO;
                    rows.add(new PassSummaryResponseDTO.PassTypeRow(pt, cnt, amt));
                    modeTotal += cnt;
                    modeAmt = modeAmt.add(amt);
                }

                modeGroups.add(new PassSummaryResponseDTO.PaymentModeGroup(mode, rows, modeTotal, modeAmt));
                grandCount += modeTotal;
                grandAmount = grandAmount.add(modeAmt);
            }

            dto.setPaymentModes(modeGroups);
            dto.setGrandTotalCount(grandCount);
            dto.setGrandTotalAmount(grandAmount);
            result.add(dto);
        }
        return result;
    }

    // ── Excel Export ─────────────────────────────────────────────────────

    public byte[] exportExcel(String plazaId, LocalDate fromDate, LocalDate toDate) throws Exception {
        List<PassSummaryResponseDTO> data = getReport(plazaId, fromDate, toDate);
        DateTimeFormatter fmt = DateTimeFormatter.ofPattern("dd-MMM-yyyy");

        try (SXSSFWorkbook wb = new SXSSFWorkbook(100)) {
            Sheet sheet = wb.createSheet("Pass Summary Report");
            sheet.setColumnWidth(0, 4000);
            sheet.setColumnWidth(1, 6000);
            sheet.setColumnWidth(2, 5000);
            sheet.setColumnWidth(3, 6000);
            sheet.setColumnWidth(4, 4000);
            sheet.setColumnWidth(5, 5000);

            // Styles
            CellStyle headerStyle = createHeaderStyle(wb);
            CellStyle dataStyle = createDataStyle(wb);
            CellStyle subtotalStyle = createSubtotalStyle(wb);
            CellStyle grandTotalStyle = createGrandTotalStyle(wb);

            // Title row
            Row titleRow = sheet.createRow(0);
            Cell titleCell = titleRow.createCell(0);
            titleCell.setCellValue("Pass Summary Report | " + fromDate.format(fmt) + " to " + toDate.format(fmt));
            CellStyle titleStyle = wb.createCellStyle();
            Font titleFont = wb.createFont();
            titleFont.setBold(true);
            titleFont.setFontHeightInPoints((short) 14);
            titleStyle.setFont(titleFont);
            titleCell.setCellStyle(titleStyle);
            sheet.addMergedRegion(new CellRangeAddress(0, 0, 0, 5));

            // Header row
            Row hdr = sheet.createRow(1);
            String[] headers = {"Plaza ID", "Plaza Name", "Payment Mode", "Pass Type", "Count", "Amount"};
            for (int i = 0; i < headers.length; i++) {
                Cell c = hdr.createCell(i);
                c.setCellValue(headers[i]);
                c.setCellStyle(headerStyle);
            }

            int rowNum = 2;
            for (PassSummaryResponseDTO plaza : data) {
                int plazaStartRow = rowNum;

                for (PassSummaryResponseDTO.PaymentModeGroup mode : plaza.getPaymentModes()) {
                    int modeStartRow = rowNum;

                    for (PassSummaryResponseDTO.PassTypeRow pt : mode.getRows()) {
                        Row row = sheet.createRow(rowNum++);
                        row.createCell(0).setCellStyle(dataStyle); // merged later
                        row.createCell(1).setCellStyle(dataStyle); // merged later
                        row.createCell(2).setCellStyle(dataStyle); // merged later
                        Cell ptCell = row.createCell(3);
                        ptCell.setCellValue(pt.getPassType());
                        ptCell.setCellStyle(dataStyle);
                        Cell cntCell = row.createCell(4);
                        cntCell.setCellValue(pt.getCount());
                        cntCell.setCellStyle(dataStyle);
                        Cell amtCell = row.createCell(5);
                        amtCell.setCellValue(pt.getAmount().doubleValue());
                        amtCell.setCellStyle(dataStyle);
                    }

                    // Subtotal row for payment mode
                    Row subRow = sheet.createRow(rowNum++);
                    subRow.createCell(0).setCellStyle(subtotalStyle);
                    subRow.createCell(1).setCellStyle(subtotalStyle);
                    subRow.createCell(2).setCellStyle(subtotalStyle);
                    Cell subLabel = subRow.createCell(3);
                    subLabel.setCellValue("Total");
                    subLabel.setCellStyle(subtotalStyle);
                    Cell subCnt = subRow.createCell(4);
                    subCnt.setCellValue(mode.getTotalCount());
                    subCnt.setCellStyle(subtotalStyle);
                    Cell subAmt = subRow.createCell(5);
                    subAmt.setCellValue(mode.getTotalAmount().doubleValue());
                    subAmt.setCellStyle(subtotalStyle);

                    // Merge Payment Mode column
                    int modeEndRow = rowNum - 1;
                    if (modeEndRow > modeStartRow) {
                        sheet.addMergedRegion(new CellRangeAddress(modeStartRow, modeEndRow, 2, 2));
                    }
                    // Set value in first cell of merged payment mode
                    sheet.getRow(modeStartRow).getCell(2).setCellValue(mode.getPaymentMode());
                }

                // Grand Total row for plaza
                Row gtRow = sheet.createRow(rowNum++);
                for (int c = 0; c <= 3; c++) {
                    Cell gc = gtRow.createCell(c);
                    gc.setCellStyle(grandTotalStyle);
                }
                Cell gtLabel = gtRow.getCell(3);
                gtLabel.setCellValue("Grand Total");
                Cell gtCnt = gtRow.createCell(4);
                gtCnt.setCellValue(plaza.getGrandTotalCount());
                gtCnt.setCellStyle(grandTotalStyle);
                Cell gtAmt = gtRow.createCell(5);
                gtAmt.setCellValue(plaza.getGrandTotalAmount().doubleValue());
                gtAmt.setCellStyle(grandTotalStyle);
                sheet.addMergedRegion(new CellRangeAddress(rowNum - 1, rowNum - 1, 0, 3));

                // Merge Plaza ID + Plaza Name across all rows
                int plazaEndRow = rowNum - 1;
                if (plazaEndRow > plazaStartRow) {
                    sheet.addMergedRegion(new CellRangeAddress(plazaStartRow, plazaEndRow, 0, 0));
                    sheet.addMergedRegion(new CellRangeAddress(plazaStartRow, plazaEndRow, 1, 1));
                }
                // Set plaza values in first row
                sheet.getRow(plazaStartRow).getCell(0).setCellValue(plaza.getPlazaId());
                sheet.getRow(plazaStartRow).getCell(1).setCellValue(plaza.getPlazaName());
            }

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            wb.write(out);
            return out.toByteArray();
        }
    }

    // ── CSV Export ───────────────────────────────────────────────────────

    public byte[] exportCsv(String plazaId, LocalDate fromDate, LocalDate toDate) throws Exception {
        List<PassSummaryResponseDTO> data = getReport(plazaId, fromDate, toDate);
        StringBuilder sb = new StringBuilder();
        sb.append('\uFEFF'); // UTF-8 BOM
        sb.append("Plaza ID,Plaza Name,Payment Mode,Pass Type,Count,Amount\n");

        for (PassSummaryResponseDTO plaza : data) {
            for (PassSummaryResponseDTO.PaymentModeGroup mode : plaza.getPaymentModes()) {
                for (PassSummaryResponseDTO.PassTypeRow pt : mode.getRows()) {
                    sb.append(csv(plaza.getPlazaId())).append(',')
                      .append(csv(plaza.getPlazaName())).append(',')
                      .append(csv(mode.getPaymentMode())).append(',')
                      .append(csv(pt.getPassType())).append(',')
                      .append(pt.getCount()).append(',')
                      .append(pt.getAmount().toPlainString()).append('\n');
                }
                sb.append(csv(plaza.getPlazaId())).append(',')
                  .append(csv(plaza.getPlazaName())).append(',')
                  .append(csv(mode.getPaymentMode())).append(',')
                  .append("Total,")
                  .append(mode.getTotalCount()).append(',')
                  .append(mode.getTotalAmount().toPlainString()).append('\n');
            }
            sb.append(csv(plaza.getPlazaId())).append(',')
              .append(csv(plaza.getPlazaName())).append(',')
              .append(",,Grand Total,")
              .append(plaza.getGrandTotalCount()).append(',')
              .append(plaza.getGrandTotalAmount().toPlainString()).append('\n');
        }
        return sb.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8);
    }

    // ── Style Helpers ─────────────────────────────────────────────────────

    private CellStyle createHeaderStyle(Workbook wb) {
        CellStyle s = wb.createCellStyle();
        Font f = wb.createFont();
        f.setBold(true);
        f.setColor(IndexedColors.WHITE.getIndex());
        s.setFont(f);
        s.setFillForegroundColor(IndexedColors.DARK_RED.getIndex());
        s.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        s.setBorderBottom(BorderStyle.THIN);
        s.setBorderTop(BorderStyle.THIN);
        s.setBorderLeft(BorderStyle.THIN);
        s.setBorderRight(BorderStyle.THIN);
        s.setAlignment(HorizontalAlignment.CENTER);
        return s;
    }

    private CellStyle createDataStyle(Workbook wb) {
        CellStyle s = wb.createCellStyle();
        s.setBorderBottom(BorderStyle.THIN);
        s.setBorderTop(BorderStyle.THIN);
        s.setBorderLeft(BorderStyle.THIN);
        s.setBorderRight(BorderStyle.THIN);
        s.setVerticalAlignment(VerticalAlignment.CENTER);
        return s;
    }

    private CellStyle createSubtotalStyle(Workbook wb) {
        CellStyle s = wb.createCellStyle();
        Font f = wb.createFont();
        f.setBold(true);
        s.setFont(f);
        s.setFillForegroundColor(IndexedColors.LIGHT_YELLOW.getIndex());
        s.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        s.setBorderBottom(BorderStyle.THIN);
        s.setBorderTop(BorderStyle.THIN);
        s.setBorderLeft(BorderStyle.THIN);
        s.setBorderRight(BorderStyle.THIN);
        return s;
    }

    private CellStyle createGrandTotalStyle(Workbook wb) {
        CellStyle s = wb.createCellStyle();
        Font f = wb.createFont();
        f.setBold(true);
        s.setFont(f);
        s.setFillForegroundColor(IndexedColors.YELLOW.getIndex());
        s.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        s.setBorderBottom(BorderStyle.MEDIUM);
        s.setBorderTop(BorderStyle.MEDIUM);
        s.setBorderLeft(BorderStyle.MEDIUM);
        s.setBorderRight(BorderStyle.MEDIUM);
        return s;
    }

    private String csv(String val) {
        if (val == null) return "";
        if (val.contains(",") || val.contains("\"") || val.contains("\n")) {
            return "\"" + val.replace("\"", "\"\"") + "\"";
        }
        return val;
    }
}
