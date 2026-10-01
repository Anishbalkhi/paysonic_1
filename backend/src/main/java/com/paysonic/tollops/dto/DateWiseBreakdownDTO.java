package com.paysonic.tollops.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

public class DateWiseBreakdownDTO {

    private LocalDate settlementDate;
    private Long txnCount;
    private BigDecimal settledAmount;

    public DateWiseBreakdownDTO() {
    }

    public DateWiseBreakdownDTO(LocalDate settlementDate, Long txnCount, BigDecimal settledAmount) {
        this.settlementDate = settlementDate;
        this.txnCount = txnCount;
        this.settledAmount = settledAmount;
    }

    public LocalDate getSettlementDate() {
        return settlementDate;
    }

    public void setSettlementDate(LocalDate settlementDate) {
        this.settlementDate = settlementDate;
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
}
