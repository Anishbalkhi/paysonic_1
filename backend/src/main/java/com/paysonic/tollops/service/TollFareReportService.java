package com.paysonic.tollops.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.paysonic.tollops.dto.TollFareItemDto;
import com.paysonic.tollops.entity.Plaza;
import com.paysonic.tollops.entity.PlazaFare;
import com.paysonic.tollops.repository.PlazaFareRepository;
import com.paysonic.tollops.repository.PlazaRepository;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.streaming.SXSSFWorkbook;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.OutputStream;
import java.io.PrintWriter;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;

@Service
public class TollFareReportService {

    private static final Logger log = LoggerFactory.getLogger(TollFareReportService.class);
    private final PlazaFareRepository plazaFareRepository;
    private final PlazaRepository plazaRepository;
    private final ObjectMapper objectMapper;

    // Standard ordered vehicle classes ordered ascending from VC4 to VC19 / VC20
    private static final List<String[]> VEHICLE_CLASS_DEFINITIONS = List.of(
            new String[]{"VC4", "Car / Jeep / Van", "5.00", "8.00", "0.00", "0.00", "500.00", "0.00"},
            new String[]{"VC5", "Light Commercial Vehicle - 2 Axle", "10.00", "12.00", "0.00", "0.00", "1000.00", "0.00"},
            new String[]{"VC6", "Light Commercial Vehicle - 3 Axle", "20.00", "22.00", "0.00", "0.00", "3300.00", "0.00"},
            new String[]{"VC7", "Bus 2 Axle", "15.00", "18.00", "0.00", "0.00", "2100.00", "0.00"},
            new String[]{"VC8", "Bus 3 Axle", "20.00", "22.00", "0.00", "0.00", "3300.00", "0.00"},
            new String[]{"VC9", "Mini Bus", "10.00", "12.00", "0.00", "0.00", "1000.00", "0.00"},
            new String[]{"VC10", "Truck 2 Axle", "15.00", "18.00", "0.00", "0.00", "2100.00", "0.00"},
            new String[]{"VC11", "Truck 3 Axle", "20.00", "22.00", "0.00", "0.00", "3300.00", "0.00"},
            new String[]{"VC12", "Truck 4 Axle", "25.00", "28.00", "0.00", "0.00", "5000.00", "0.00"},
            new String[]{"VC13", "Truck 5 Axle", "25.00", "28.00", "0.00", "0.00", "5000.00", "0.00"},
            new String[]{"VC14", "Truck 6 Axle", "25.00", "28.00", "0.00", "0.00", "5000.00", "0.00"},
            new String[]{"VC15", "Truck Multi Axle (7 and above)", "25.00", "28.00", "0.00", "0.00", "5000.00", "0.00"},
            new String[]{"VC16", "Earth moving machinery", "25.00", "28.00", "0.00", "0.00", "5000.00", "0.00"},
            new String[]{"VC17", "Heavy Construction machinery", "25.00", "28.00", "0.00", "0.00", "5000.00", "0.00"},
            new String[]{"VC18", "Tractor", "250.00", "125.00", "0.00", "0.00", "0.00", "0.00"},
            new String[]{"VC19", "tractor-with-trailer", "300.00", "150.00", "0.00", "0.00", "0.00", "0.00"},
            new String[]{"VC20", "Tata Ace or similar mini light commercial vehicle", "5.00", "8.00", "0.00", "0.00", "1000.00", "0.00"}
    );

    public TollFareReportService(PlazaFareRepository plazaFareRepository,
                                  PlazaRepository plazaRepository,
                                  ObjectMapper objectMapper) {
        this.plazaFareRepository = plazaFareRepository;
        this.plazaRepository = plazaRepository;
        this.objectMapper = objectMapper;
    }

    /**
     * Retrieve toll fare items for a given plaza (or all plazas) and vehicle class filter
     */
    public List<TollFareItemDto> getFares(String plazaId, String vehicleClass) {
        List<TollFareItemDto> results = new ArrayList<>();

        // If plazaId is null or "ALL", select primary plaza "600601" or load all configured plazas
        String effectivePlazaId = (plazaId != null && !plazaId.trim().isEmpty() && !"ALL".equalsIgnoreCase(plazaId.trim()))
                ? plazaId.trim()
                : "600601";

        List<String> targetPlazaIds = new ArrayList<>();
        if ("ALL".equalsIgnoreCase(plazaId)) {
            List<PlazaFare> allFares = plazaFareRepository.findAll();
            if (!allFares.isEmpty()) {
                for (PlazaFare pf : allFares) {
                    targetPlazaIds.add(pf.getPlazaId());
                }
            } else {
                targetPlazaIds.add("600601");
            }
        } else {
            targetPlazaIds.add(effectivePlazaId);
        }

        Map<String, String> plazaNames = new HashMap<>();
        for (Plaza p : plazaRepository.findAll()) {
            plazaNames.put(p.getId(), p.getName());
        }

        for (String pid : targetPlazaIds) {
            String pName = plazaNames.getOrDefault(pid, "Dummytollplaza1");
            Optional<PlazaFare> fareOpt = plazaFareRepository.findById(pid);
            Map<String, Map<String, Object>> fareMap = Collections.emptyMap();

            if (fareOpt.isPresent() && fareOpt.get().getFaresJson() != null && !fareOpt.get().getFaresJson().trim().isEmpty()) {
                try {
                    fareMap = objectMapper.readValue(fareOpt.get().getFaresJson(), new TypeReference<>() {});
                } catch (Exception e) {
                    log.warn("Failed to parse faresJson for plaza {}: {}", pid, e.getMessage());
                }
            }

            for (String[] def : VEHICLE_CLASS_DEFINITIONS) {
                String vc = def[0];
                String desc = def[1];

                if (vehicleClass != null && !vehicleClass.trim().isEmpty() && !"ALL".equalsIgnoreCase(vehicleClass.trim())) {
                    if (!vc.equalsIgnoreCase(vehicleClass.trim())) {
                        continue;
                    }
                }

                Map<String, Object> rates = fareMap.get(vc);
                BigDecimal single = rates != null && rates.containsKey("single") ? toBigDecimal(rates.get("single")) : new BigDecimal(def[2]);
                BigDecimal ret = rates != null && rates.containsKey("ret") ? toBigDecimal(rates.get("ret")) : new BigDecimal(def[3]);
                BigDecimal monthly50 = rates != null && rates.containsKey("monthly") ? toBigDecimal(rates.get("monthly")) : new BigDecimal(def[4]);
                BigDecimal local10 = rates != null && rates.containsKey("local10") ? toBigDecimal(rates.get("local10")) : new BigDecimal(def[5]);
                BigDecimal local20 = rates != null && rates.containsKey("local20") ? toBigDecimal(rates.get("local20")) : new BigDecimal(def[6]);
                BigDecimal commercial = rates != null && rates.containsKey("district") ? toBigDecimal(rates.get("district")) : new BigDecimal(def[7]);

                results.add(new TollFareItemDto(
                        pid,
                        pName,
                        vc,
                        desc,
                        single.setScale(2, RoundingMode.HALF_UP),
                        ret.setScale(2, RoundingMode.HALF_UP),
                        monthly50.setScale(2, RoundingMode.HALF_UP),
                        local10.setScale(2, RoundingMode.HALF_UP),
                        local20.setScale(2, RoundingMode.HALF_UP),
                        commercial.setScale(2, RoundingMode.HALF_UP)
                ));
            }
        }

        return results;
    }

    private BigDecimal toBigDecimal(Object val) {
        if (val == null) return BigDecimal.ZERO;
        try {
            return new BigDecimal(String.valueOf(val));
        } catch (Exception e) {
            return BigDecimal.ZERO;
        }
    }

    /**
     * Stream Excel (.xlsx) export with Royal Blue theme and centered header banner
     */
    public void streamExcelExport(String plazaId, String vehicleClass, OutputStream outputStream) throws Exception {
        List<TollFareItemDto> items = getFares(plazaId, vehicleClass);

        try (SXSSFWorkbook workbook = new SXSSFWorkbook(100)) {
            Sheet sheet = workbook.createSheet("Toll Fare Report");
            DataFormat dataFormat = workbook.createDataFormat();

            // 1. Title Style (Bold Royal Blue, 16pt, Centered)
            CellStyle titleStyle = workbook.createCellStyle();
            Font titleFont = workbook.createFont();
            titleFont.setFontName("Calibri");
            titleFont.setFontHeightInPoints((short) 16);
            titleFont.setBold(true);
            titleFont.setColor(IndexedColors.DARK_BLUE.getIndex());
            titleStyle.setFont(titleFont);
            titleStyle.setAlignment(HorizontalAlignment.CENTER);
            titleStyle.setVerticalAlignment(VerticalAlignment.CENTER);

            // 2. Subtitle Style (Muted Grey, 10pt, Centered)
            CellStyle subTitleStyle = workbook.createCellStyle();
            Font subFont = workbook.createFont();
            subFont.setFontName("Calibri");
            subFont.setFontHeightInPoints((short) 10);
            subFont.setColor(IndexedColors.GREY_50_PERCENT.getIndex());
            subTitleStyle.setFont(subFont);
            subTitleStyle.setAlignment(HorizontalAlignment.CENTER);
            subTitleStyle.setVerticalAlignment(VerticalAlignment.CENTER);

            // 3. Green Accent Line Style
            CellStyle greenBarStyle = workbook.createCellStyle();
            greenBarStyle.setFillForegroundColor(IndexedColors.GREEN.getIndex());
            greenBarStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);

            // 4. Header Style (Royal Blue fill, Bold White text, Borders)
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

            // 5. Data Cell Styles
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

            String[] headers = {
                    "TollPlazaID", "Vechile Class", "Vechile Desc", "Single Journey",
                    "Return Journey", "Monthly 50-Trips", "Monthly Local - Under 10km",
                    "Monthly Local - Under 20km", "Local Pass - Commercial Fare"
            };

            // Row 0: Title Banner
            Row titleRow = sheet.createRow(0);
            titleRow.setHeightInPoints(28);
            Cell titleCell = titleRow.createCell(0);
            titleCell.setCellValue("TOLL FARE REPORT");
            titleCell.setCellStyle(titleStyle);
            sheet.addMergedRegion(new CellRangeAddress(0, 0, 0, headers.length - 1));

            // Row 1: Subtitle
            Row subRow = sheet.createRow(1);
            subRow.setHeightInPoints(18);
            Cell subCell = subRow.createCell(0);
            String pStr = (plazaId != null && !plazaId.trim().isEmpty()) ? plazaId : "600601";
            subCell.setCellValue("Plaza: " + pStr + " | Effective FASTag Toll Fare Matrix");
            subCell.setCellStyle(subTitleStyle);
            sheet.addMergedRegion(new CellRangeAddress(1, 1, 0, headers.length - 1));

            // Row 2: Green Accent Bar
            Row greenRow = sheet.createRow(2);
            greenRow.setHeightInPoints(4);
            for (int i = 0; i < headers.length; i++) {
                Cell gc = greenRow.createCell(i);
                gc.setCellStyle(greenBarStyle);
            }

            // Row 3: Header Row
            Row headerRow = sheet.createRow(3);
            headerRow.setHeightInPoints(26);
            for (int i = 0; i < headers.length; i++) {
                Cell cell = headerRow.createCell(i);
                cell.setCellValue(headers[i]);
                cell.setCellStyle(headerStyle);
            }

            // Rows 4+: Data Rows
            int rowIdx = 4;
            for (TollFareItemDto item : items) {
                Row row = sheet.createRow(rowIdx++);
                row.setHeightInPoints(20);

                Cell c0 = row.createCell(0); c0.setCellValue(item.getTollPlazaId()); c0.setCellStyle(centerStyle);
                Cell c1 = row.createCell(1); c1.setCellValue(item.getVehicleClass()); c1.setCellStyle(centerStyle);
                Cell c2 = row.createCell(2); c2.setCellValue(item.getVehicleDesc()); c2.setCellStyle(textStyle);

                Cell c3 = row.createCell(3); c3.setCellValue(item.getSingleJourney().doubleValue()); c3.setCellStyle(numberStyle);
                Cell c4 = row.createCell(4); c4.setCellValue(item.getReturnJourney().doubleValue()); c4.setCellStyle(numberStyle);
                Cell c5 = row.createCell(5); c5.setCellValue(item.getMonthly50Trips().doubleValue()); c5.setCellStyle(numberStyle);
                Cell c6 = row.createCell(6); c6.setCellValue(item.getMonthlyLocalUnder10km().doubleValue()); c6.setCellStyle(numberStyle);
                Cell c7 = row.createCell(7); c7.setCellValue(item.getMonthlyLocalUnder20km().doubleValue()); c7.setCellStyle(numberStyle);
                Cell c8 = row.createCell(8); c8.setCellValue(item.getLocalPassCommercialFare().doubleValue()); c8.setCellStyle(numberStyle);
            }

            // Summary Footer Note
            rowIdx++;
            Row noteRow = sheet.createRow(rowIdx);
            noteRow.setHeightInPoints(18);
            Cell noteCell = noteRow.createCell(0);
            noteCell.setCellValue("* This report generated from Paysonic Database directly on demand");
            noteCell.setCellStyle(subTitleStyle);
            sheet.addMergedRegion(new CellRangeAddress(rowIdx, rowIdx, 0, headers.length - 1));

            int[] colWidths = {16, 16, 40, 18, 18, 20, 26, 26, 26};
            for (int i = 0; i < headers.length; i++) {
                sheet.setColumnWidth(i, colWidths[i] * 256);
            }

            workbook.write(outputStream);
            workbook.dispose();
            log.info("Streamed Toll Fare Excel Export with {} rows", items.size());
        }
    }

    /**
     * Stream CSV export with UTF-8 BOM, centered header banner, and exact 9 columns
     */
    public void streamCsvExport(String plazaId, String vehicleClass, OutputStream outputStream) throws Exception {
        List<TollFareItemDto> items = getFares(plazaId, vehicleClass);

        // Prepend UTF-8 BOM
        outputStream.write(0xEF);
        outputStream.write(0xBB);
        outputStream.write(0xBF);

        PrintWriter writer = new PrintWriter(outputStream, true);

        String[] headers = {
                "TollPlazaID", "Vechile Class", "Vechile Desc", "Single Journey",
                "Return Journey", "Monthly 50-Trips", "Monthly Local - Under 10km",
                "Monthly Local - Under 20km", "Local Pass - Commercial Fare"
        };

        int midIdx = headers.length / 2;
        String[] titleLine = new String[headers.length];
        String[] subLine = new String[headers.length];
        for (int i = 0; i < headers.length; i++) {
            titleLine[i] = "";
            subLine[i] = "";
        }
        titleLine[midIdx] = "TOLL FARE REPORT";
        String pStr = (plazaId != null && !plazaId.trim().isEmpty()) ? plazaId : "600601";
        subLine[midIdx] = "Plaza: " + pStr + " | Effective FASTag Toll Fare Matrix";

        writer.println(String.join(",", titleLine));
        writer.println(String.join(",", subLine));
        writer.println();
        writer.println(String.join(",", headers));

        for (TollFareItemDto item : items) {
            String[] row = {
                    escapeCsv(item.getTollPlazaId()),
                    escapeCsv(item.getVehicleClass()),
                    escapeCsv(item.getVehicleDesc()),
                    item.getSingleJourney().toString(),
                    item.getReturnJourney().toString(),
                    item.getMonthly50Trips().toString(),
                    item.getMonthlyLocalUnder10km().toString(),
                    item.getMonthlyLocalUnder20km().toString(),
                    item.getLocalPassCommercialFare().toString()
            };
            writer.println(String.join(",", row));
        }

        // Summary footer
        writer.println();
        writer.println("* This report generated from Paysonic Database directly on demand,,,,,,,,");

        writer.flush();
        log.info("Streamed Toll Fare CSV Export with {} rows", items.size());
    }

    private String escapeCsv(String val) {
        if (val == null) return "";
        if (val.contains(",") || val.contains("\"") || val.contains("\n") || val.contains("\r")) {
            return "\"" + val.replace("\"", "\"\"") + "\"";
        }
        return val;
    }
}
