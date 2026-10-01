package com.paysonic.tollops.dto;

import java.math.BigDecimal;
import java.util.List;

public class PassSummaryResponseDTO {

    private String plazaId;
    private String plazaName;
    private List<PaymentModeGroup> paymentModes;
    private long grandTotalCount;
    private BigDecimal grandTotalAmount;

    // ── nested classes ──────────────────────────────────────────────────

    public static class PassTypeRow {
        private String passType;
        private long count;
        private BigDecimal amount;

        public PassTypeRow() {}
        public PassTypeRow(String passType, long count, BigDecimal amount) {
            this.passType = passType;
            this.count = count;
            this.amount = amount;
        }

        public String getPassType() { return passType; }
        public void setPassType(String passType) { this.passType = passType; }
        public long getCount() { return count; }
        public void setCount(long count) { this.count = count; }
        public BigDecimal getAmount() { return amount; }
        public void setAmount(BigDecimal amount) { this.amount = amount; }
    }

    public static class PaymentModeGroup {
        private String paymentMode;
        private List<PassTypeRow> rows;
        private long totalCount;
        private BigDecimal totalAmount;

        public PaymentModeGroup() {}
        public PaymentModeGroup(String paymentMode, List<PassTypeRow> rows, long totalCount, BigDecimal totalAmount) {
            this.paymentMode = paymentMode;
            this.rows = rows;
            this.totalCount = totalCount;
            this.totalAmount = totalAmount;
        }

        public String getPaymentMode() { return paymentMode; }
        public void setPaymentMode(String paymentMode) { this.paymentMode = paymentMode; }
        public List<PassTypeRow> getRows() { return rows; }
        public void setRows(List<PassTypeRow> rows) { this.rows = rows; }
        public long getTotalCount() { return totalCount; }
        public void setTotalCount(long totalCount) { this.totalCount = totalCount; }
        public BigDecimal getTotalAmount() { return totalAmount; }
        public void setTotalAmount(BigDecimal totalAmount) { this.totalAmount = totalAmount; }
    }

    // ── root getters/setters ─────────────────────────────────────────────

    public String getPlazaId() { return plazaId; }
    public void setPlazaId(String plazaId) { this.plazaId = plazaId; }
    public String getPlazaName() { return plazaName; }
    public void setPlazaName(String plazaName) { this.plazaName = plazaName; }
    public List<PaymentModeGroup> getPaymentModes() { return paymentModes; }
    public void setPaymentModes(List<PaymentModeGroup> paymentModes) { this.paymentModes = paymentModes; }
    public long getGrandTotalCount() { return grandTotalCount; }
    public void setGrandTotalCount(long grandTotalCount) { this.grandTotalCount = grandTotalCount; }
    public BigDecimal getGrandTotalAmount() { return grandTotalAmount; }
    public void setGrandTotalAmount(BigDecimal grandTotalAmount) { this.grandTotalAmount = grandTotalAmount; }
}
