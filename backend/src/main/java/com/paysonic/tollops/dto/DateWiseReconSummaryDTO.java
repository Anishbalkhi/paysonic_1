package com.paysonic.tollops.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

public class DateWiseReconSummaryDTO {

    private String rowId;
    private String plazaId;
    private String plazaName;
    private LocalDate txnDate;
    private Long txnCount;
    private BigDecimal settledAmount;
    private List<DateWiseBreakdownDTO> breakdowns = new ArrayList<>();

    public DateWiseReconSummaryDTO() {
    }

    public DateWiseReconSummaryDTO(String plazaId, String plazaName, LocalDate txnDate, Long txnCount, BigDecimal settledAmount) {
        this.plazaId = plazaId;
        this.plazaName = plazaName;
        this.txnDate = txnDate;
        this.txnCount = txnCount;
        this.settledAmount = settledAmount != null ? settledAmount : BigDecimal.ZERO;
        this.rowId = (plazaId != null ? plazaId : "") + "_" + (txnDate != null ? txnDate.toString() : "");
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
        updateRowId();
    }

    public String getPlazaName() {
        return plazaName;
    }

    public void setPlazaName(String plazaName) {
        this.plazaName = plazaName;
    }

    public LocalDate getTxnDate() {
        return txnDate;
    }

    public void setTxnDate(LocalDate txnDate) {
        this.txnDate = txnDate;
        updateRowId();
    }

    public Long getTxnCount() {
        return txnCount;
    }

    public void setTxnCount(Long txnCount) {
        this.txnCount = txnCount;
    }

    public BigDecimal getSettledAmount() {
        return settledAmount;
    }

    public void setSettledAmount(BigDecimal settledAmount) {
        this.settledAmount = settledAmount;
    }

    public List<DateWiseBreakdownDTO> getBreakdowns() {
        return breakdowns;
    }

    public void setBreakdowns(List<DateWiseBreakdownDTO> breakdowns) {
        this.breakdowns = breakdowns;
    }

    private void updateRowId() {
        this.rowId = (plazaId != null ? plazaId : "") + "_" + (txnDate != null ? txnDate.toString() : "");
    }
}
