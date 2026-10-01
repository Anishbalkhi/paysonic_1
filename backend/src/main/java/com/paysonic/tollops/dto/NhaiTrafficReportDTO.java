package com.paysonic.tollops.dto;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

public class NhaiTrafficReportDTO {

    private String plazaCode;
    private String plazaName;
    private String fromDate;
    private String toDate;
    private List<VehicleClassGroup> vehicleClasses = new ArrayList<>();
    private List<JourneyTotalItem> journeyTotals = new ArrayList<>();
    private GrandTotalItem grandTotal = new GrandTotalItem();

    public static class VehicleClassGroup {
        private String classCode;
        private String className;
        private int displayOrder;
        private List<JourneyRow> journeys = new ArrayList<>();

        public VehicleClassGroup() {}

        public VehicleClassGroup(String classCode, String className, int displayOrder) {
            this.classCode = classCode;
            this.className = className;
            this.displayOrder = displayOrder;
        }

        public String getClassCode() {
            return classCode;
        }

        public void setClassCode(String classCode) {
            this.classCode = classCode;
        }

        public String getClassName() {
            return className;
        }

        public void setClassName(String className) {
            this.className = className;
        }

        public int getDisplayOrder() {
            return displayOrder;
        }

        public void setDisplayOrder(int displayOrder) {
            this.displayOrder = displayOrder;
        }

        public List<JourneyRow> getJourneys() {
            return journeys;
        }

        public void setJourneys(List<JourneyRow> journeys) {
            this.journeys = journeys;
        }
    }

    public static class JourneyRow {
        private String journeyType;
        private BigDecimal tollFare;
        private Long transactionCount;
        private BigDecimal transactionAmount;

        public JourneyRow() {}

        public JourneyRow(String journeyType, BigDecimal tollFare, Long transactionCount, BigDecimal transactionAmount) {
            this.journeyType = journeyType;
            this.tollFare = tollFare;
            this.transactionCount = transactionCount;
            this.transactionAmount = transactionAmount;
        }

        public String getJourneyType() {
            return journeyType;
        }

        public void setJourneyType(String journeyType) {
            this.journeyType = journeyType;
        }

        public BigDecimal getTollFare() {
            return tollFare;
        }

        public void setTollFare(BigDecimal tollFare) {
            this.tollFare = tollFare;
        }

        public Long getTransactionCount() {
            return transactionCount;
        }

        public void setTransactionCount(Long transactionCount) {
            this.transactionCount = transactionCount;
        }

        public BigDecimal getTransactionAmount() {
            return transactionAmount;
        }

        public void setTransactionAmount(BigDecimal transactionAmount) {
            this.transactionAmount = transactionAmount;
        }
    }

    public static class JourneyTotalItem {
        private String journeyType;
        private Long transactionCount = 0L;
        private BigDecimal transactionAmount = BigDecimal.ZERO;

        public JourneyTotalItem() {}

        public JourneyTotalItem(String journeyType, Long transactionCount, BigDecimal transactionAmount) {
            this.journeyType = journeyType;
            this.transactionCount = transactionCount;
            this.transactionAmount = transactionAmount;
        }

        public String getJourneyType() {
            return journeyType;
        }

        public void setJourneyType(String journeyType) {
            this.journeyType = journeyType;
        }

        public Long getTransactionCount() {
            return transactionCount;
        }

        public void setTransactionCount(Long transactionCount) {
            this.transactionCount = transactionCount;
        }

        public BigDecimal getTransactionAmount() {
            return transactionAmount;
        }

        public void setTransactionAmount(BigDecimal transactionAmount) {
            this.transactionAmount = transactionAmount;
        }
    }

    public static class GrandTotalItem {
        private Long totalCount = 0L;
        private BigDecimal totalAmount = BigDecimal.ZERO;

        public GrandTotalItem() {}

        public GrandTotalItem(Long totalCount, BigDecimal totalAmount) {
            this.totalCount = totalCount;
            this.totalAmount = totalAmount;
        }

        public Long getTotalCount() {
            return totalCount;
        }

        public void setTotalCount(Long totalCount) {
            this.totalCount = totalCount;
        }

        public BigDecimal getTotalAmount() {
            return totalAmount;
        }

        public void setTotalAmount(BigDecimal totalAmount) {
            this.totalAmount = totalAmount;
        }
    }

    public NhaiTrafficReportDTO() {}

    public String getPlazaCode() {
        return plazaCode;
    }

    public void setPlazaCode(String plazaCode) {
        this.plazaCode = plazaCode;
    }

    public String getPlazaName() {
        return plazaName;
    }

    public void setPlazaName(String plazaName) {
        this.plazaName = plazaName;
    }

    public String getFromDate() {
        return fromDate;
    }

    public void setFromDate(String fromDate) {
        this.fromDate = fromDate;
    }

    public String getToDate() {
        return toDate;
    }

    public void setToDate(String toDate) {
        this.toDate = toDate;
    }

    public List<VehicleClassGroup> getVehicleClasses() {
        return vehicleClasses;
    }

    public void setVehicleClasses(List<VehicleClassGroup> vehicleClasses) {
        this.vehicleClasses = vehicleClasses;
    }

    public List<JourneyTotalItem> getJourneyTotals() {
        return journeyTotals;
    }

    public void setJourneyTotals(List<JourneyTotalItem> journeyTotals) {
        this.journeyTotals = journeyTotals;
    }

    public GrandTotalItem getGrandTotal() {
        return grandTotal;
    }

    public void setGrandTotal(GrandTotalItem grandTotal) {
        this.grandTotal = grandTotal;
    }
}
