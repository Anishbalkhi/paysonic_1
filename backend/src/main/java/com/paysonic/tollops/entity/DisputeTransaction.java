package com.paysonic.tollops.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "dispute_transactions", indexes = {
    @Index(name = "idx_disp_txn_date", columnList = "txn_date_time"),
    @Index(name = "idx_disp_plaza_date", columnList = "plaza_id, txn_date_time"),
    @Index(name = "idx_disp_func_code", columnList = "function_code"),
    @Index(name = "idx_disp_tag_id", columnList = "tag_id")
})
public class DisputeTransaction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "plaza_name", length = 120, nullable = false)
    private String plazaName;

    @Column(name = "plaza_id", length = 32, nullable = false)
    private String plazaId;

    @Column(name = "acq_txn_id", length = 32, nullable = false)
    private String acqTxnId;

    @Column(name = "toll_txn_id", length = 32, nullable = false)
    private String tollTxnId;

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
    private String issuerId;

    @Column(name = "int_tracking_no", length = 32)
    private String intTrackingNo = "NA";

    @Column(name = "function_code", length = 64, nullable = false)
    private String functionCode; // e.g. "753: Debit Adjustment", "762: Credit Adjustment"

    @Column(name = "settlement_indicator", length = 10, nullable = false)
    private String settlementIndicator; // "Dr", "Cr", "--"

    @Column(name = "message_reason_code", length = 100)
    private String messageReasonCode; // e.g. "1005: MMT", "0: money debited"

    @Column(name = "member_message_text", length = 255)
    private String memberMessageText; // e.g. "User crossed toll plaza no extra money debited"

    @Column(name = "npci_settlement_date")
    private LocalDate npciSettlementDate;

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
        if (txnAmount == null) {
            txnAmount = BigDecimal.ZERO;
        }
        if (disputeAmount == null) {
            disputeAmount = BigDecimal.ZERO;
        }
    }

    public DisputeTransaction() {
    }

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

    public String getPlazaName() { return plazaName; }
    public void setPlazaName(String plazaName) { this.plazaName = plazaName; }

    public String getPlazaId() { return plazaId; }
    public void setPlazaId(String plazaId) { this.plazaId = plazaId; }

    public String getAcqTxnId() { return acqTxnId; }
    public void setAcqTxnId(String acqTxnId) { this.acqTxnId = acqTxnId; }

    public String getTollTxnId() { return tollTxnId; }
    public void setTollTxnId(String tollTxnId) { this.tollTxnId = tollTxnId; }

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

    public String getSettlementIndicator() { return settlementIndicator; }
    public void setSettlementIndicator(String settlementIndicator) { this.settlementIndicator = settlementIndicator; }

    public String getMessageReasonCode() { return messageReasonCode; }
    public void setMessageReasonCode(String messageReasonCode) { this.messageReasonCode = messageReasonCode; }

    public String getMemberMessageText() { return memberMessageText; }
    public void setMemberMessageText(String memberMessageText) { this.memberMessageText = memberMessageText; }

    public LocalDate getNpciSettlementDate() { return npciSettlementDate; }
    public void setNpciSettlementDate(LocalDate npciSettlementDate) { this.npciSettlementDate = npciSettlementDate; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
