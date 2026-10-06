package com.paysonic.tollops.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "violation_raw_files", indexes = {
    @Index(name = "idx_raw_tag_id", columnList = "tag_id"),
    @Index(name = "idx_raw_txn_id", columnList = "txn_id"),
    @Index(name = "idx_raw_plaza_id", columnList = "toll_plaza_id"),
    @Index(name = "idx_raw_txn_time", columnList = "txn_time")
})
public class ViolationRawRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "tag_id", length = 64, nullable = false)
    private String tagId;

    @Column(name = "function_code", length = 16, nullable = false)
    private String functionCode = "763";

    @Column(name = "txn_time", length = 32, nullable = false)
    private String txnTime;

    @Column(name = "txn_id", length = 64, nullable = false)
    private String txnId;

    @Column(name = "issuer_id", length = 32, nullable = false)
    private String issuerId;

    @Column(name = "acquirer_id", length = 32, nullable = false)
    private String acquirerId = "720030";

    @Column(name = "txn_amount", precision = 12, scale = 2, nullable = false)
    private BigDecimal txnAmount = BigDecimal.ZERO;

    @Column(name = "reason_code", length = 16, nullable = false)
    private String reasonCode = "1005";

    @Column(name = "full_partial_indicator", length = 8, nullable = false)
    private String fullPartialIndicator = "P";

    @Column(name = "toll_plaza_id", length = 32, nullable = false)
    private String tollPlazaId = "501101";

    @Column(name = "tid", length = 64, nullable = false)
    private String tid;

    @Column(name = "mmt", length = 64)
    private String mmt;

    @Column(name = "internal_tracking_number", length = 64)
    private String internalTrackingNumber = "NA";

    @Column(name = "parsed_date_time")
    private LocalDateTime parsedDateTime;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    public ViolationRawRecord() {}

    public ViolationRawRecord(String tagId, String functionCode, String txnTime, String txnId,
                              String issuerId, String acquirerId, BigDecimal txnAmount,
                              String reasonCode, String fullPartialIndicator, String tollPlazaId,
                              String tid, String mmt, String internalTrackingNumber) {
        this.tagId = tagId;
        this.functionCode = functionCode != null ? functionCode : "763";
        this.txnTime = txnTime;
        this.txnId = txnId;
        this.issuerId = issuerId;
        this.acquirerId = acquirerId != null ? acquirerId : "720030";
        this.txnAmount = txnAmount != null ? txnAmount : BigDecimal.ZERO;
        this.reasonCode = reasonCode != null ? reasonCode : "1005";
        this.fullPartialIndicator = fullPartialIndicator != null ? fullPartialIndicator : "P";
        this.tollPlazaId = tollPlazaId != null ? tollPlazaId : "501101";
        this.tid = tid != null ? tid : tagId;
        this.mmt = mmt;
        this.internalTrackingNumber = internalTrackingNumber != null ? internalTrackingNumber : "NA";
        this.parsedDateTime = parseRawTime(txnTime);
        this.createdAt = LocalDateTime.now();
    }

    @PrePersist
    public void prePersist() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
        if (parsedDateTime == null && txnTime != null) {
            parsedDateTime = parseRawTime(txnTime);
        }
        if (functionCode == null) functionCode = "763";
        if (acquirerId == null) acquirerId = "720030";
        if (reasonCode == null) reasonCode = "1005";
        if (fullPartialIndicator == null) fullPartialIndicator = "P";
        if (internalTrackingNumber == null) internalTrackingNumber = "NA";
    }

    private LocalDateTime parseRawTime(String raw) {
        if (raw == null || raw.length() < 12) return LocalDateTime.now();
        try {
            int yy = Integer.parseInt(raw.substring(0, 2)) + 2000;
            int mm = Integer.parseInt(raw.substring(2, 4));
            int dd = Integer.parseInt(raw.substring(4, 6));
            int hh = Integer.parseInt(raw.substring(6, 8));
            int mi = Integer.parseInt(raw.substring(8, 10));
            int ss = Integer.parseInt(raw.substring(10, 12));
            return LocalDateTime.of(yy, mm, dd, hh, mi, ss);
        } catch (Exception e) {
            return LocalDateTime.now();
        }
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getTagId() {
        return tagId;
    }

    public void setTagId(String tagId) {
        this.tagId = tagId;
    }

    public String getFunctionCode() {
        return functionCode;
    }

    public void setFunctionCode(String functionCode) {
        this.functionCode = functionCode;
    }

    public String getTxnTime() {
        return txnTime;
    }

    public void setTxnTime(String txnTime) {
        this.txnTime = txnTime;
        this.parsedDateTime = parseRawTime(txnTime);
    }

    public String getTxnId() {
        return txnId;
    }

    public void setTxnId(String txnId) {
        this.txnId = txnId;
    }

    public String getIssuerId() {
        return issuerId;
    }

    public void setIssuerId(String issuerId) {
        this.issuerId = issuerId;
    }

    public String getAcquirerId() {
        return acquirerId;
    }

    public void setAcquirerId(String acquirerId) {
        this.acquirerId = acquirerId;
    }

    public BigDecimal getTxnAmount() {
        return txnAmount;
    }

    public void setTxnAmount(BigDecimal txnAmount) {
        this.txnAmount = txnAmount;
    }

    public String getReasonCode() {
        return reasonCode;
    }

    public void setReasonCode(String reasonCode) {
        this.reasonCode = reasonCode;
    }

    public String getFullPartialIndicator() {
        return fullPartialIndicator;
    }

    public void setFullPartialIndicator(String fullPartialIndicator) {
        this.fullPartialIndicator = fullPartialIndicator;
    }

    public String getTollPlazaId() {
        return tollPlazaId;
    }

    public void setTollPlazaId(String tollPlazaId) {
        this.tollPlazaId = tollPlazaId;
    }

    public String getTid() {
        return tid;
    }

    public void setTid(String tid) {
        this.tid = tid;
    }

    public String getMmt() {
        return mmt;
    }

    public void setMmt(String mmt) {
        this.mmt = mmt;
    }

    public String getInternalTrackingNumber() {
        return internalTrackingNumber;
    }

    public void setInternalTrackingNumber(String internalTrackingNumber) {
        this.internalTrackingNumber = internalTrackingNumber;
    }

    public LocalDateTime getParsedDateTime() {
        return parsedDateTime;
    }

    public void setParsedDateTime(LocalDateTime parsedDateTime) {
        this.parsedDateTime = parsedDateTime;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
