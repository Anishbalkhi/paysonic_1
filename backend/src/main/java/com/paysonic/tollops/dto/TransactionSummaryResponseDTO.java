package com.paysonic.tollops.dto;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

public class TransactionSummaryResponseDTO {

    private String fromDate;
    private String toDate;
    private String selectedPlaza;
    private List<PlazaSummaryGroup> plazas = new ArrayList<>();
    private OverallGrandTotal grandTotal = new OverallGrandTotal();

    public static class PlazaSummaryGroup {
        private String plazaId;
        private String plazaName;
        private List<StatusGroup> statusGroups = new ArrayList<>();
        private Long plazaTotalCount = 0L;
        private BigDecimal plazaTotalAmount = BigDecimal.ZERO;

        public PlazaSummaryGroup() {}

        public PlazaSummaryGroup(String plazaId, String plazaName) {
            this.plazaId = plazaId;
            this.plazaName = plazaName;
        }

        public String getPlazaId() {
            return plazaId;
        }

        public void setPlazaId(String plazaId) {
            this.plazaId = plazaId;
        }

        public String getPlazaName() {
            return plazaName;
        }

        public void setPlazaName(String plazaName) {
            this.plazaName = plazaName;
        }

        public List<StatusGroup> getStatusGroups() {
            return statusGroups;
        }

        public void setStatusGroups(List<StatusGroup> statusGroups) {
            this.statusGroups = statusGroups;
        }

        public Long getPlazaTotalCount() {
            return plazaTotalCount;
        }

        public void setPlazaTotalCount(Long plazaTotalCount) {
            this.plazaTotalCount = plazaTotalCount;
        }

        public BigDecimal getPlazaTotalAmount() {
            return plazaTotalAmount;
        }

        public void setPlazaTotalAmount(BigDecimal plazaTotalAmount) {
            this.plazaTotalAmount = plazaTotalAmount;
        }
    }

    public static class StatusGroup {
        private String transactionStatus; // "Declined", "NPCIDecline", "Accepted"
        private List<ResponseCodeRow> rows = new ArrayList<>();
        private Long subtotalCount = 0L;
        private BigDecimal subtotalAmount = BigDecimal.ZERO;

        public StatusGroup() {}

        public StatusGroup(String transactionStatus) {
            this.transactionStatus = transactionStatus;
        }

        public String getTransactionStatus() {
            return transactionStatus;
        }

        public void setTransactionStatus(String transactionStatus) {
            this.transactionStatus = transactionStatus;
        }

        public List<ResponseCodeRow> getRows() {
            return rows;
        }

        public void setRows(List<ResponseCodeRow> rows) {
            this.rows = rows;
        }

        public Long getSubtotalCount() {
            return subtotalCount;
        }

        public void setSubtotalCount(Long subtotalCount) {
            this.subtotalCount = subtotalCount;
        }

        public BigDecimal getSubtotalAmount() {
            return subtotalAmount;
        }

        public void setSubtotalAmount(BigDecimal subtotalAmount) {
            this.subtotalAmount = subtotalAmount;
        }
    }

    public static class ResponseCodeRow {
        private String responseCode;
        private Long transactionCount;
        private BigDecimal transactionAmount;

        public ResponseCodeRow() {}

        public ResponseCodeRow(String responseCode, Long transactionCount, BigDecimal transactionAmount) {
            this.responseCode = responseCode;
            this.transactionCount = transactionCount;
            this.transactionAmount = transactionAmount;
        }

        public String getResponseCode() {
            return responseCode;
        }

        public void setResponseCode(String responseCode) {
            this.responseCode = responseCode;
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

    public static class OverallGrandTotal {
        private Long totalCount = 0L;
        private BigDecimal totalAmount = BigDecimal.ZERO;
        private Long acceptedCount = 0L;
        private BigDecimal acceptedAmount = BigDecimal.ZERO;
        private Long declinedCount = 0L;
        private BigDecimal declinedAmount = BigDecimal.ZERO;

        public OverallGrandTotal() {}

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

        public Long getAcceptedCount() {
            return acceptedCount;
        }

        public void setAcceptedCount(Long acceptedCount) {
            this.acceptedCount = acceptedCount;
        }

        public BigDecimal getAcceptedAmount() {
            return acceptedAmount;
        }

        public void setAcceptedAmount(BigDecimal acceptedAmount) {
            this.acceptedAmount = acceptedAmount;
        }

        public Long getDeclinedCount() {
            return declinedCount;
        }

        public void setDeclinedCount(Long declinedCount) {
            this.declinedCount = declinedCount;
        }

        public BigDecimal getDeclinedAmount() {
            return declinedAmount;
        }

        public void setDeclinedAmount(BigDecimal declinedAmount) {
            this.declinedAmount = declinedAmount;
        }
    }

    public TransactionSummaryResponseDTO() {}

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

    public String getSelectedPlaza() {
        return selectedPlaza;
    }

    public void setSelectedPlaza(String selectedPlaza) {
        this.selectedPlaza = selectedPlaza;
    }

    public List<PlazaSummaryGroup> getPlazas() {
        return plazas;
    }

    public void setPlazas(List<PlazaSummaryGroup> plazas) {
        this.plazas = plazas;
    }

    public OverallGrandTotal getGrandTotal() {
        return grandTotal;
    }

    public void setGrandTotal(OverallGrandTotal grandTotal) {
        this.grandTotal = grandTotal;
    }
}
