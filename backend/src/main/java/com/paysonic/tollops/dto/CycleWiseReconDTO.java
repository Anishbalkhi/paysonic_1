package com.paysonic.tollops.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Data Transfer Object representing a Cycle Wise Reconciliation record.
 * Maps directly to the NPCI Acquirer Settlement Spreadsheet layout.
 */
public class CycleWiseReconDTO {

    private String rowId;
    private String plazaId;
    private String plazaName;
    private LocalDate plazaSettlementDate;
    private String reconCycle;
    private Long txnCount;
    private BigDecimal txnAmount;
    private Long disputeAddCount;
    private BigDecimal disputeAddAmount;
    private Long disputeSubCount;
    private BigDecimal disputeSubAmount;
    private BigDecimal totalAmount;
    private BigDecimal serviceFees;
    private BigDecimal serviceGst;
    private BigDecimal fee130;
    private BigDecimal gstOnFee130;
    private BigDecimal settledAmount;

    public CycleWiseReconDTO() {
        this.txnCount = 0L;
        this.txnAmount = BigDecimal.ZERO;
        this.disputeAddCount = 0L;
        this.disputeAddAmount = BigDecimal.ZERO;
        this.disputeSubCount = 0L;
        this.disputeSubAmount = BigDecimal.ZERO;
        this.totalAmount = BigDecimal.ZERO;
        this.serviceFees = BigDecimal.ZERO;
        this.serviceGst = BigDecimal.ZERO;
        this.fee130 = BigDecimal.ZERO;
        this.gstOnFee130 = BigDecimal.ZERO;
        this.settledAmount = BigDecimal.ZERO;
    }

    public CycleWiseReconDTO(String plazaId, String plazaName, LocalDate plazaSettlementDate, String reconCycle,
                             Long txnCount, BigDecimal txnAmount,
                             Long disputeAddCount, BigDecimal disputeAddAmount,
                             Long disputeSubCount, BigDecimal disputeSubAmount,
                             BigDecimal totalAmount, BigDecimal serviceFees, BigDecimal serviceGst,
                             BigDecimal fee130, BigDecimal gstOnFee130, BigDecimal settledAmount) {
        this.plazaId = plazaId;
        this.plazaName = plazaName;
        this.plazaSettlementDate = plazaSettlementDate;
        this.reconCycle = reconCycle;
        this.txnCount = txnCount != null ? txnCount : 0L;
        this.txnAmount = txnAmount != null ? txnAmount : BigDecimal.ZERO;
        this.disputeAddCount = disputeAddCount != null ? disputeAddCount : 0L;
        this.disputeAddAmount = disputeAddAmount != null ? disputeAddAmount : BigDecimal.ZERO;
        this.disputeSubCount = disputeSubCount != null ? disputeSubCount : 0L;
        this.disputeSubAmount = disputeSubAmount != null ? disputeSubAmount : BigDecimal.ZERO;
        this.totalAmount = totalAmount != null ? totalAmount : BigDecimal.ZERO;
        this.serviceFees = serviceFees != null ? serviceFees : BigDecimal.ZERO;
        this.serviceGst = serviceGst != null ? serviceGst : BigDecimal.ZERO;
        this.fee130 = fee130 != null ? fee130 : BigDecimal.ZERO;
        this.gstOnFee130 = gstOnFee130 != null ? gstOnFee130 : BigDecimal.ZERO;
        this.settledAmount = settledAmount != null ? settledAmount : BigDecimal.ZERO;
        this.rowId = (plazaId != null ? plazaId : "") + "_" + (plazaSettlementDate != null ? plazaSettlementDate.toString() : "") + "_C" + (reconCycle != null ? reconCycle : "0");
    }

    public String getRowId() {
        return rowId;
    }

    public void setRowId(String rowId) {
        this.rowId = rowId;
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

    public LocalDate getPlazaSettlementDate() {
        return plazaSettlementDate;
    }

    public void setPlazaSettlementDate(LocalDate plazaSettlementDate) {
        this.plazaSettlementDate = plazaSettlementDate;
    }

    public String getReconCycle() {
        return reconCycle;
    }

    public void setReconCycle(String reconCycle) {
        this.reconCycle = reconCycle;
    }

    public Long getTxnCount() {
        return txnCount;
    }

    public void setTxnCount(Long txnCount) {
        this.txnCount = txnCount;
    }

    public BigDecimal getTxnAmount() {
        return txnAmount;
    }

    public void setTxnAmount(BigDecimal txnAmount) {
        this.txnAmount = txnAmount;
    }

    public Long getDisputeAddCount() {
        return disputeAddCount;
    }

    public void setDisputeAddCount(Long disputeAddCount) {
        this.disputeAddCount = disputeAddCount;
    }

    public BigDecimal getDisputeAddAmount() {
        return disputeAddAmount;
    }

    public void setDisputeAddAmount(BigDecimal disputeAddAmount) {
        this.disputeAddAmount = disputeAddAmount;
    }

    public Long getDisputeSubCount() {
        return disputeSubCount;
    }

    public void setDisputeSubCount(Long disputeSubCount) {
        this.disputeSubCount = disputeSubCount;
    }

    public BigDecimal getDisputeSubAmount() {
        return disputeSubAmount;
    }

    public void setDisputeSubAmount(BigDecimal disputeSubAmount) {
        this.disputeSubAmount = disputeSubAmount;
    }

    public BigDecimal getTotalAmount() {
        return totalAmount;
    }

    public void setTotalAmount(BigDecimal totalAmount) {
        this.totalAmount = totalAmount;
    }

    public BigDecimal getServiceFees() {
        return serviceFees;
    }

    public void setServiceFees(BigDecimal serviceFees) {
        this.serviceFees = serviceFees;
    }

    public BigDecimal getServiceGst() {
        return serviceGst;
    }

    public void setServiceGst(BigDecimal serviceGst) {
        this.serviceGst = serviceGst;
    }

    public BigDecimal getFee130() {
        return fee130;
    }

    public void setFee130(BigDecimal fee130) {
        this.fee130 = fee130;
    }

    public BigDecimal getGstOnFee130() {
        return gstOnFee130;
    }

    public void setGstOnFee130(BigDecimal gstOnFee130) {
        this.gstOnFee130 = gstOnFee130;
    }

    public BigDecimal getSettledAmount() {
        return settledAmount;
    }

    public void setSettledAmount(BigDecimal settledAmount) {
        this.settledAmount = settledAmount;
    }
}
