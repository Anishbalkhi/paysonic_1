package com.paysonic.tollops.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "dispute_transactions", indexes = {
    @Index(name = "idx_disp_dispute_id", columnList = "dispute_id"),
    @Index(name = "idx_disp_batch_id", columnList = "batch_id"),
    @Index(name = "idx_disp_acq_txn_id", columnList = "acq_txn_id"),
    @Index(name = "idx_disp_txn_date", columnList = "txn_date_time"),
    @Index(name = "idx_disp_plaza_date", columnList = "plaza_id, txn_date_time"),
    @Index(name = "idx_disp_func_code", columnList = "function_code"),
    @Index(name = "idx_disp_tag_id", columnList = "tag_id"),
    @Index(name = "idx_disp_lifecycle", columnList = "lifecycle_status")
})
public class DisputeTransaction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "dispute_id", length = 64)
    private String disputeId;

    @Column(name = "batch_id", length = 64)
    private String batchId;

    @Column(name = "plaza_name", length = 120, nullable = false)
    private String plazaName;

    @Column(name = "plaza_id", length = 32, nullable = false)
    private String plazaId;

    @Column(name = "acq_txn_id", length = 32, nullable = false)
    private String acqTxnId;

    @Column(name = "toll_txn_id", length = 32, nullable = false)
    private String tollTxnId;

    @Column(name = "lane_id", length = 32)
    private String laneId = "Lane-01";

    @Column(name = "txn_date_time", nullable = false)
    private LocalDateTime txnDateTime;

    @Column(name = "txn_amount", precision = 10, scale = 2, nullable = false)
    private BigDecimal txnAmount = BigDecimal.ZERO;

    @Column(name = "dispute_amount", precision = 10, scale = 2, nullable = false)
    private BigDecimal disputeAmount = BigDecimal.ZERO;

    @Column(name = "vehicle_no", length = 32, nullable = false)
    private String vehicleNo;

    @Column(name = "tag_id", length = 64, nullable = false)
    private String tagId;

    @Column(name = "tid", length = 64, nullable = false)
    private String tid;

    @Column(name = "issuer_id", length = 32, nullable = false)
    private String issuerId = "NA";

    @Column(name = "int_tracking_no", length = 32)
    private String intTrackingNo = "NA";

    @Column(name = "function_code", length = 64, nullable = false)
    private String functionCode; // e.g. "450"

    @Column(name = "function_label", length = 100)
    private String functionLabel;

    @Column(name = "settlement_indicator", length = 10, nullable = false)
    private String settlementIndicator = "Dr"; // "Dr", "Cr", "--"

    @Column(name = "message_reason_code", length = 100)
    private String messageReasonCode;

    @Column(name = "member_message_text", length = 255)
    private String memberMessageText;

    @Column(name = "settlement_date", length = 32)
    private String settlementDate;

    @Column(name = "tat_due_date", length = 32)
    private String tatDueDate;

    @Column(name = "cb_raised_date", length = 32)
    private String cbRaisedDate;

    @Column(name = "npci_settlement_date")
    private LocalDate npciSettlementDate;

    @Column(name = "assigned", nullable = false)
    private Boolean assigned = false;

    @Column(name = "assigned_at")
    private LocalDateTime assignedAt;

    @Column(name = "assigned_to_plaza", length = 32)
    private String assignedToPlaza;

    @Column(name = "admin_remarks", length = 500)
    private String adminRemarks;

    @Column(name = "admin_remarks_at")
    private LocalDateTime adminRemarksAt;

    @Column(name = "plaza_action", length = 32)
    private String plazaAction; // "Accepted", "Rejected", "No", "Yes"

    @Column(name = "plaza_action_at")
    private LocalDateTime plazaActionAt;

    @Column(name = "plaza_action_time", length = 32)
    private String plazaActionTime; // IST: "DD-MM-YYYY HH:mm:ss"

    @Column(name = "plaza_action_by", length = 100)
    private String plazaActionBy;

    @Column(name = "plaza_remarks", length = 500)
    private String plazaRemarks;

    @Column(name = "counter_evidence_name", length = 255)
    private String counterEvidenceName;

    @Column(name = "counter_evidence_url", columnDefinition = "TEXT")
    private String counterEvidenceUrl;

    @Column(name = "dispute_status", length = 32, nullable = false)
    private String disputeStatus = "NA"; // "NA", "Approved", "Rejected"

    @Column(name = "lifecycle_status", length = 64, nullable = false)
    private String lifecycleStatus = "Pending Assignment";

    @Column(name = "closed", nullable = false)
    private Boolean closed = false;

    @Column(name = "closed_at")
    private LocalDateTime closedAt;

    @Column(name = "closed_by", length = 100)
    private String closedBy;

    @Column(name = "close_remarks", length = 500)
    private String closeRemarks;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    public void prePersist() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
        if (intTrackingNo == null) {
            intTrackingNo = "NA";
        }
        if (issuerId == null) {
            issuerId = "NA";
        }
        if (settlementIndicator == null) {
            settlementIndicator = "Dr";
        }
        if (txnAmount == null) {
            txnAmount = BigDecimal.ZERO;
        }
        if (disputeAmount == null) {
            disputeAmount = BigDecimal.ZERO;
        }
        if (assigned == null) {
            assigned = false;
        }
        if (closed == null) {
            closed = false;
        }
        if (disputeStatus == null) {
            disputeStatus = "NA";
        }
        if (lifecycleStatus == null) {
            lifecycleStatus = "Pending Assignment";
        }
        if (laneId == null) {
            laneId = "Lane-01";
        }
    }

    public DisputeTransaction() {}

    public DisputeTransaction(
            String plazaName, String plazaId, String acqTxnId, String tollTxnId,
            LocalDateTime txnDateTime, BigDecimal txnAmount, BigDecimal disputeAmount,
            String vehicleNo, String tagId, String tid, String issuerId,
            String intTrackingNo, String functionCode, String settlementIndicator,
            String messageReasonCode, String memberMessageText, LocalDate npciSettlementDate) {
        this.plazaName = plazaName;
        this.plazaId = plazaId;
        this.acqTxnId = acqTxnId;
        this.tollTxnId = tollTxnId;
        this.txnDateTime = txnDateTime;
        this.txnAmount = txnAmount;
        this.disputeAmount = disputeAmount;
        this.vehicleNo = vehicleNo;
        this.tagId = tagId;
        this.tid = tid;
        this.issuerId = issuerId;
        this.intTrackingNo = intTrackingNo;
        this.functionCode = functionCode;
        this.settlementIndicator = settlementIndicator;
        this.messageReasonCode = messageReasonCode;
        this.memberMessageText = memberMessageText;
        this.npciSettlementDate = npciSettlementDate;
    }

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getDisputeId() { return disputeId; }
    public void setDisputeId(String disputeId) { this.disputeId = disputeId; }

    public String getBatchId() { return batchId; }
    public void setBatchId(String batchId) { this.batchId = batchId; }

    public String getPlazaName() { return plazaName; }
    public void setPlazaName(String plazaName) { this.plazaName = plazaName; }

    public String getPlazaId() { return plazaId; }
    public void setPlazaId(String plazaId) { this.plazaId = plazaId; }

    public String getAcqTxnId() { return acqTxnId; }
    public void setAcqTxnId(String acqTxnId) { this.acqTxnId = acqTxnId; }

    public String getTollTxnId() { return tollTxnId; }
    public void setTollTxnId(String tollTxnId) { this.tollTxnId = tollTxnId; }

    public String getLaneId() { return laneId; }
    public void setLaneId(String laneId) { this.laneId = laneId; }

    public LocalDateTime getTxnDateTime() { return txnDateTime; }
    public void setTxnDateTime(LocalDateTime txnDateTime) { this.txnDateTime = txnDateTime; }

    public BigDecimal getTxnAmount() { return txnAmount; }
    public void setTxnAmount(BigDecimal txnAmount) { this.txnAmount = txnAmount; }

    public BigDecimal getDisputeAmount() { return disputeAmount; }
    public void setDisputeAmount(BigDecimal disputeAmount) { this.disputeAmount = disputeAmount; }

    public String getVehicleNo() { return vehicleNo; }
    public void setVehicleNo(String vehicleNo) { this.vehicleNo = vehicleNo; }

    public String getTagId() { return tagId; }
    public void setTagId(String tagId) { this.tagId = tagId; }

    public String getTid() { return tid; }
    public void setTid(String tid) { this.tid = tid; }

    public String getIssuerId() { return issuerId; }
    public void setIssuerId(String issuerId) { this.issuerId = issuerId; }

    public String getIntTrackingNo() { return intTrackingNo; }
    public void setIntTrackingNo(String intTrackingNo) { this.intTrackingNo = intTrackingNo; }

    public String getFunctionCode() { return functionCode; }
    public void setFunctionCode(String functionCode) { this.functionCode = functionCode; }

    public String getFunctionLabel() { return functionLabel; }
    public void setFunctionLabel(String functionLabel) { this.functionLabel = functionLabel; }

    public String getSettlementIndicator() { return settlementIndicator; }
    public void setSettlementIndicator(String settlementIndicator) { this.settlementIndicator = settlementIndicator; }

    public String getMessageReasonCode() { return messageReasonCode; }
    public void setMessageReasonCode(String messageReasonCode) { this.messageReasonCode = messageReasonCode; }

    public String getMemberMessageText() { return memberMessageText; }
    public void setMemberMessageText(String memberMessageText) { this.memberMessageText = memberMessageText; }

    public String getSettlementDate() { return settlementDate; }
    public void setSettlementDate(String settlementDate) { this.settlementDate = settlementDate; }

    public String getTatDueDate() { return tatDueDate; }
    public void setTatDueDate(String tatDueDate) { this.tatDueDate = tatDueDate; }

    public String getCbRaisedDate() { return cbRaisedDate; }
    public void setCbRaisedDate(String cbRaisedDate) { this.cbRaisedDate = cbRaisedDate; }

    public LocalDate getNpciSettlementDate() { return npciSettlementDate; }
    public void setNpciSettlementDate(LocalDate npciSettlementDate) { this.npciSettlementDate = npciSettlementDate; }

    public Boolean getAssigned() { return assigned; }
    public void setAssigned(Boolean assigned) { this.assigned = assigned; }

    public LocalDateTime getAssignedAt() { return assignedAt; }
    public void setAssignedAt(LocalDateTime assignedAt) { this.assignedAt = assignedAt; }

    public String getAssignedToPlaza() { return assignedToPlaza; }
    public void setAssignedToPlaza(String assignedToPlaza) { this.assignedToPlaza = assignedToPlaza; }

    public String getAdminRemarks() { return adminRemarks; }
    public void setAdminRemarks(String adminRemarks) { this.adminRemarks = adminRemarks; }

    public LocalDateTime getAdminRemarksAt() { return adminRemarksAt; }
    public void setAdminRemarksAt(LocalDateTime adminRemarksAt) { this.adminRemarksAt = adminRemarksAt; }

    public String getPlazaAction() { return plazaAction; }
    public void setPlazaAction(String plazaAction) { this.plazaAction = plazaAction; }

    public LocalDateTime getPlazaActionAt() { return plazaActionAt; }
    public void setPlazaActionAt(LocalDateTime plazaActionAt) { this.plazaActionAt = plazaActionAt; }

    public String getPlazaActionTime() { return plazaActionTime; }
    public void setPlazaActionTime(String plazaActionTime) { this.plazaActionTime = plazaActionTime; }

    public String getPlazaActionBy() { return plazaActionBy; }
    public void setPlazaActionBy(String plazaActionBy) { this.plazaActionBy = plazaActionBy; }

    public String getPlazaRemarks() { return plazaRemarks; }
    public void setPlazaRemarks(String plazaRemarks) { this.plazaRemarks = plazaRemarks; }

    public String getCounterEvidenceName() { return counterEvidenceName; }
    public void setCounterEvidenceName(String counterEvidenceName) { this.counterEvidenceName = counterEvidenceName; }

    public String getCounterEvidenceUrl() { return counterEvidenceUrl; }
    public void setCounterEvidenceUrl(String counterEvidenceUrl) { this.counterEvidenceUrl = counterEvidenceUrl; }

    public String getDisputeStatus() { return disputeStatus; }
    public void setDisputeStatus(String disputeStatus) { this.disputeStatus = disputeStatus; }

    public String getLifecycleStatus() { return lifecycleStatus; }
    public void setLifecycleStatus(String lifecycleStatus) { this.lifecycleStatus = lifecycleStatus; }

    public Boolean getClosed() { return closed; }
    public void setClosed(Boolean closed) { this.closed = closed; }

    public LocalDateTime getClosedAt() { return closedAt; }
    public void setClosedAt(LocalDateTime closedAt) { this.closedAt = closedAt; }

    public String getClosedBy() { return closedBy; }
    public void setClosedBy(String closedBy) { this.closedBy = closedBy; }

    public String getCloseRemarks() { return closeRemarks; }
    public void setCloseRemarks(String closeRemarks) { this.closeRemarks = closeRemarks; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
