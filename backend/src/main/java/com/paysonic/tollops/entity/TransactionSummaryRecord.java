package com.paysonic.tollops.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "transaction_summary_reports")
public class TransactionSummaryRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "plaza_id", length = 32, nullable = false)
    private String plazaId;

    @Column(name = "plaza_name", length = 128, nullable = false)
    private String plazaName;

    @Column(name = "report_date", nullable = false)
    private LocalDate reportDate;

    @Column(name = "transaction_status", length = 50, nullable = false)
    private String transactionStatus; // "Declined", "NPCIDecline", "Accepted"

    @Column(name = "response_code", length = 50, nullable = false)
    private String responseCode; // "DUPLICATE", "BLKLISTTAG", "MALTAG", "Error:164", "ACCEPTED", "DISCOUNTRP", "EXEMPTED"

    @Column(name = "transaction_count", nullable = false)
    private Long transactionCount;

    @Column(name = "transaction_amount", precision = 14, scale = 2, nullable = false)
    private BigDecimal transactionAmount;

    @Column(name = "display_order")
    private Integer displayOrder;

    @Column(name = "created_at")
    private LocalDateTime createdAt = LocalDateTime.now();

    public TransactionSummaryRecord() {}

    public TransactionSummaryRecord(
            String plazaId, String plazaName, LocalDate reportDate,
            String transactionStatus, String responseCode,
            Long transactionCount, BigDecimal transactionAmount,
            Integer displayOrder) {
        this.plazaId = plazaId;
        this.plazaName = plazaName;
        this.reportDate = reportDate;
        this.transactionStatus = transactionStatus;
        this.responseCode = responseCode;
        this.transactionCount = transactionCount;
        this.transactionAmount = transactionAmount;
        this.displayOrder = displayOrder;
        this.createdAt = LocalDateTime.now();
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
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

    public LocalDate getReportDate() {
        return reportDate;
    }

    public void setReportDate(LocalDate reportDate) {
        this.reportDate = reportDate;
    }

    public String getTransactionStatus() {
        return transactionStatus;
    }

    public void setTransactionStatus(String transactionStatus) {
        this.transactionStatus = transactionStatus;
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

    public Integer getDisplayOrder() {
        return displayOrder;
    }

    public void setDisplayOrder(Integer displayOrder) {
        this.displayOrder = displayOrder;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
