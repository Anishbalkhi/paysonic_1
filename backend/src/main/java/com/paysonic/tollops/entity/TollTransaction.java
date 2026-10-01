package com.paysonic.tollops.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "toll_transactions", indexes = {
    @Index(name = "idx_trs_txn_date", columnList = "txn_date"),
    @Index(name = "idx_trs_plaza_date", columnList = "plaza_id, txn_date"),
    @Index(name = "idx_trs_status", columnList = "status"),
    @Index(name = "idx_trs_acq_txn_id", columnList = "acq_txn_id")
})
public class TollTransaction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "acq_txn_id", length = 32, nullable = false, unique = true)
    private String acqTxnId;

    @Column(name = "toll_file_name", length = 50, nullable = false)
    private String tollFileName = "ONLINE";

    @Column(name = "plaza_id", length = 32, nullable = false)
    private String plazaId;

    @Column(name = "plaza_name", length = 120, nullable = false)
    private String plazaName;

    @Column(name = "lane_id", length = 32, nullable = false)
    private String laneId;

    @Column(name = "tag_id", length = 64, nullable = false)
    private String tagId;

    @Column(name = "vrn", length = 32, nullable = false)
    private String vrn;

    @Column(name = "toll_txn_id", length = 32, nullable = false)
    private String tollTxnId;

    @Column(name = "toll_message_id", length = 32, nullable = false)
    private String tollMessageId;

    @Column(name = "mvc", length = 16)
    private String mvc;

    @Column(name = "tag_vc", length = 16)
    private String tagVc;

    @Column(name = "avc", length = 16)
    private String avc;

    @Column(name = "status", length = 32, nullable = false)
    private String status;

    @Column(name = "reason", length = 64)
    private String reason;

    @Column(name = "txn_amount", precision = 10, scale = 2, nullable = false)
    private BigDecimal txnAmount = BigDecimal.ZERO;

    @Column(name = "settled_amount", precision = 10, scale = 2)
    private BigDecimal settledAmount;

    @Column(name = "txn_date", nullable = false)
    private LocalDateTime txnDate;

    @Column(name = "plaza_post_date")
    private LocalDateTime plazaPostDate;

    @Column(name = "npci_error_code", length = 32)
    private String npciErrorCode;

    @Column(name = "npci_settled_date")
    private LocalDateTime npciSettledDate;

    @Column(name = "clearing_cycle", length = 32)
    private String clearingCycle;

    @Column(name = "plaza_settle_date")
    private LocalDateTime plazaSettleDate;

    @Column(name = "txn_type", length = 32)
    private String txnType;

    @Column(name = "npci_resp_date")
    private LocalDateTime npciRespDate;

    @Column(name = "plaza_type", length = 32, nullable = false)
    private String plazaType = "Toll";

    @Column(name = "is_violation", length = 8, nullable = false)
    private String isViolation = "No";

    @Column(name = "audit_vc", length = 32)
    private String auditVc = "NA";

    @Column(name = "violation_settled_amount", precision = 10, scale = 2)
    private BigDecimal violationSettledAmount;

    @Column(name = "violation_settled_date")
    private LocalDateTime violationSettledDate;

    @Column(name = "dispute_add_amount", precision = 10, scale = 2)
    private BigDecimal disputeAddAmount = BigDecimal.ZERO;

    @Column(name = "dispute_sub_amount", precision = 10, scale = 2)
    private BigDecimal disputeSubAmount = BigDecimal.ZERO;

    @Column(name = "is_dispute_add", length = 8)
    private String isDisputeAdd = "No";

    @Column(name = "is_dispute_sub", length = 8)
    private String isDisputeSub = "No";

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    public void prePersist() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
        if (tollFileName == null) {
            tollFileName = "ONLINE";
        }
        if (plazaType == null) {
            plazaType = "Toll";
        }
        if (isViolation == null) {
            isViolation = "No";
        }
        if (disputeAddAmount == null) {
            disputeAddAmount = BigDecimal.ZERO;
        }
        if (disputeSubAmount == null) {
            disputeSubAmount = BigDecimal.ZERO;
        }
        if (isDisputeAdd == null) {
            isDisputeAdd = "No";
        }
        if (isDisputeSub == null) {
            isDisputeSub = "No";
        }
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getAcqTxnId() {
        return acqTxnId;
    }

    public void setAcqTxnId(String acqTxnId) {
        this.acqTxnId = acqTxnId;
    }

    public String getTollFileName() {
        return tollFileName;
    }

    public void setTollFileName(String tollFileName) {
        this.tollFileName = tollFileName;
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

    public String getLaneId() {
        return laneId;
    }

    public void setLaneId(String laneId) {
        this.laneId = laneId;
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

    public String getTollTxnId() {
        return tollTxnId;
    }

    public void setTollTxnId(String tollTxnId) {
        this.tollTxnId = tollTxnId;
    }

    public String getTollMessageId() {
        return tollMessageId;
    }

    public void setTollMessageId(String tollMessageId) {
        this.tollMessageId = tollMessageId;
    }

    public String getMvc() {
        return mvc;
    }

    public void setMvc(String mvc) {
        this.mvc = mvc;
    }

    public String getTagVc() {
        return tagVc;
    }

    public void setTagVc(String tagVc) {
        this.tagVc = tagVc;
    }

    public String getAvc() {
        return avc;
    }

    public void setAvc(String avc) {
        this.avc = avc;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getReason() {
        return reason;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }

    public BigDecimal getTxnAmount() {
        return txnAmount;
    }

    public void setTxnAmount(BigDecimal txnAmount) {
        this.txnAmount = txnAmount;
    }

    public BigDecimal getSettledAmount() {
        return settledAmount;
    }

    public void setSettledAmount(BigDecimal settledAmount) {
        this.settledAmount = settledAmount;
    }

    public LocalDateTime getTxnDate() {
        return txnDate;
    }

    public void setTxnDate(LocalDateTime txnDate) {
        this.txnDate = txnDate;
    }

    public LocalDateTime getPlazaPostDate() {
        return plazaPostDate;
    }

    public void setPlazaPostDate(LocalDateTime plazaPostDate) {
        this.plazaPostDate = plazaPostDate;
    }

    public String getNpciErrorCode() {
        return npciErrorCode;
    }

    public void setNpciErrorCode(String npciErrorCode) {
        this.npciErrorCode = npciErrorCode;
    }

    public LocalDateTime getNpciSettledDate() {
        return npciSettledDate;
    }

    public void setNpciSettledDate(LocalDateTime npciSettledDate) {
        this.npciSettledDate = npciSettledDate;
    }

    public String getClearingCycle() {
        return clearingCycle;
    }

    public void setClearingCycle(String clearingCycle) {
        this.clearingCycle = clearingCycle;
    }

    public LocalDateTime getPlazaSettleDate() {
        return plazaSettleDate;
    }

    public void setPlazaSettleDate(LocalDateTime plazaSettleDate) {
        this.plazaSettleDate = plazaSettleDate;
    }

    public String getTxnType() {
        return txnType;
    }

    public void setTxnType(String txnType) {
        this.txnType = txnType;
    }

    public LocalDateTime getNpciRespDate() {
        return npciRespDate;
    }

    public void setNpciRespDate(LocalDateTime npciRespDate) {
        this.npciRespDate = npciRespDate;
    }

    public String getPlazaType() {
        return plazaType;
    }

    public void setPlazaType(String plazaType) {
        this.plazaType = plazaType;
    }

    public String getIsViolation() {
        return isViolation;
    }

    public void setIsViolation(String isViolation) {
        this.isViolation = isViolation;
    }

    public String getAuditVc() {
        return auditVc;
    }

    public void setAuditVc(String auditVc) {
        this.auditVc = auditVc;
    }

    public BigDecimal getViolationSettledAmount() {
        return violationSettledAmount;
    }

    public void setViolationSettledAmount(BigDecimal violationSettledAmount) {
        this.violationSettledAmount = violationSettledAmount;
    }

    public LocalDateTime getViolationSettledDate() {
        return violationSettledDate;
    }

    public void setViolationSettledDate(LocalDateTime violationSettledDate) {
        this.violationSettledDate = violationSettledDate;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public BigDecimal getDisputeAddAmount() {
        return disputeAddAmount;
    }

    public void setDisputeAddAmount(BigDecimal disputeAddAmount) {
        this.disputeAddAmount = disputeAddAmount;
    }

    public BigDecimal getDisputeSubAmount() {
        return disputeSubAmount;
    }

    public void setDisputeSubAmount(BigDecimal disputeSubAmount) {
        this.disputeSubAmount = disputeSubAmount;
    }

    public String getIsDisputeAdd() {
        return isDisputeAdd;
    }

    public void setIsDisputeAdd(String isDisputeAdd) {
        this.isDisputeAdd = isDisputeAdd;
    }

    public String getIsDisputeSub() {
        return isDisputeSub;
    }

    public void setIsDisputeSub(String isDisputeSub) {
        this.isDisputeSub = isDisputeSub;
    }
}
