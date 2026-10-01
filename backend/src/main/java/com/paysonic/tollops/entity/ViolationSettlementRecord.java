package com.paysonic.tollops.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "violation_settlement_reports", indexes = {
    @Index(name = "idx_vset_txn_date", columnList = "txn_date_time"),
    @Index(name = "idx_vset_plaza_date", columnList = "plaza_id, txn_date_time"),
    @Index(name = "idx_vset_tag_id", columnList = "tag_id"),
    @Index(name = "idx_vset_vrn", columnList = "vrn"),
    @Index(name = "idx_vset_status", columnList = "npci_violation_status")
})
public class ViolationSettlementRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "plaza_id", length = 32, nullable = false)
    private String plazaId;

    @Column(name = "plaza_name", length = 120, nullable = false)
    private String plazaName;

    @Column(name = "tag_id", length = 64, nullable = false)
    private String tagId;

    @Column(name = "vrn", length = 32, nullable = false)
    private String vrn;

    @Column(name = "acq_txn_id", length = 32, nullable = false)
    private String acqTxnId;

    @Column(name = "toll_txn_id", length = 32, nullable = false)
    private String tollTxnId;

    @Column(name = "txn_date_time", nullable = false)
    private LocalDateTime txnDateTime;

    @Column(name = "mvc", length = 16)
    private String mvc;

    @Column(name = "avc", length = 16)
    private String avc;

    @Column(name = "audit_vc", length = 16)
    private String auditVc;

    @Column(name = "audit_remark", length = 64)
    private String auditRemark;

    @Column(name = "npci_violation_status", length = 32, nullable = false)
    private String npciViolationStatus = "ACCEPTED";

    @Column(name = "txn_amount", precision = 10, scale = 2, nullable = false)
    private BigDecimal txnAmount = BigDecimal.ZERO;

    @Column(name = "violation_adjustment_amount", precision = 10, scale = 2)
    private BigDecimal violationAdjustmentAmount = BigDecimal.ZERO;

    @Column(name = "violation_settlement_amount", precision = 10, scale = 2)
    private BigDecimal violationSettlementAmount = BigDecimal.ZERO;

    @Column(name = "settlement_date")
    private LocalDate settlementDate;

    @Column(name = "img_received_time")
    private LocalDateTime imgReceivedTime;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    public ViolationSettlementRecord() {}

    public ViolationSettlementRecord(String plazaId, String plazaName, String tagId, String vrn,
                                   String acqTxnId, String tollTxnId, LocalDateTime txnDateTime,
                                   String mvc, String avc, String auditVc, String auditRemark,
                                   String npciViolationStatus, BigDecimal txnAmount,
                                   BigDecimal violationAdjustmentAmount, BigDecimal violationSettlementAmount,
                                   LocalDate settlementDate, LocalDateTime imgReceivedTime) {
        this.plazaId = plazaId;
        this.plazaName = plazaName;
        this.tagId = tagId;
        this.vrn = vrn;
        this.acqTxnId = acqTxnId;
        this.tollTxnId = tollTxnId;
        this.txnDateTime = txnDateTime;
        this.mvc = mvc;
        this.avc = avc;
        this.auditVc = auditVc;
        this.auditRemark = auditRemark;
        this.npciViolationStatus = npciViolationStatus != null ? npciViolationStatus : "ACCEPTED";
        this.txnAmount = txnAmount != null ? txnAmount : BigDecimal.ZERO;
        this.violationAdjustmentAmount = violationAdjustmentAmount != null ? violationAdjustmentAmount : BigDecimal.ZERO;
        this.violationSettlementAmount = violationSettlementAmount != null ? violationSettlementAmount : BigDecimal.ZERO;
        this.settlementDate = settlementDate;
        this.imgReceivedTime = imgReceivedTime;
        this.createdAt = LocalDateTime.now();
    }

    @PrePersist
    public void prePersist() {
        if (createdAt == null) createdAt = LocalDateTime.now();
        if (npciViolationStatus == null) npciViolationStatus = "ACCEPTED";
        if (violationAdjustmentAmount == null) violationAdjustmentAmount = BigDecimal.ZERO;
        if (violationSettlementAmount == null) violationSettlementAmount = BigDecimal.ZERO;
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

    public String getTagId() {
        return tagId;
    }

    public void setTagId(String tagId) {
        this.tagId = tagId;
    }

    public String getVrn() {
        return vrn;
    }

    public void setVrn(String vrn) {
        this.vrn = vrn;
    }

    public String getAcqTxnId() {
        return acqTxnId;
    }

    public void setAcqTxnId(String acqTxnId) {
        this.acqTxnId = acqTxnId;
    }

    public String getTollTxnId() {
        return tollTxnId;
    }

    public void setTollTxnId(String tollTxnId) {
        this.tollTxnId = tollTxnId;
    }

    public LocalDateTime getTxnDateTime() {
        return txnDateTime;
    }

    public void setTxnDateTime(LocalDateTime txnDateTime) {
        this.txnDateTime = txnDateTime;
    }

    public String getMvc() {
        return mvc;
    }

    public void setMvc(String mvc) {
        this.mvc = mvc;
    }

    public String getAvc() {
        return avc;
    }

    public void setAvc(String avc) {
        this.avc = avc;
    }

    public String getAuditVc() {
        return auditVc;
    }

    public void setAuditVc(String auditVc) {
        this.auditVc = auditVc;
    }

    public String getAuditRemark() {
        return auditRemark;
    }

    public void setAuditRemark(String auditRemark) {
        this.auditRemark = auditRemark;
    }

    public String getNpciViolationStatus() {
        return npciViolationStatus;
    }

    public void setNpciViolationStatus(String npciViolationStatus) {
        this.npciViolationStatus = npciViolationStatus;
    }

    public BigDecimal getTxnAmount() {
        return txnAmount;
    }

    public void setTxnAmount(BigDecimal txnAmount) {
        this.txnAmount = txnAmount;
    }

    public BigDecimal getViolationAdjustmentAmount() {
        return violationAdjustmentAmount;
    }

    public void setViolationAdjustmentAmount(BigDecimal violationAdjustmentAmount) {
        this.violationAdjustmentAmount = violationAdjustmentAmount;
    }

    public BigDecimal getViolationSettlementAmount() {
        return violationSettlementAmount;
    }

    public void setViolationSettlementAmount(BigDecimal violationSettlementAmount) {
        this.violationSettlementAmount = violationSettlementAmount;
    }

    public LocalDate getSettlementDate() {
        return settlementDate;
    }

    public void setSettlementDate(LocalDate settlementDate) {
        this.settlementDate = settlementDate;
    }

    public LocalDateTime getImgReceivedTime() {
        return imgReceivedTime;
    }

    public void setImgReceivedTime(LocalDateTime imgReceivedTime) {
        this.imgReceivedTime = imgReceivedTime;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
