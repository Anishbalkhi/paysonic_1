package com.paysonic.tollops.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "violation_transactions", indexes = {
    @Index(name = "idx_viol_txn_date", columnList = "txn_date_time"),
    @Index(name = "idx_viol_plaza_date", columnList = "plaza_id, txn_date_time"),
    @Index(name = "idx_viol_api_status", columnList = "violation_api_status"),
    @Index(name = "idx_viol_tag_id", columnList = "tag_id"),
    @Index(name = "idx_viol_vrn", columnList = "vrn")
})
public class ViolationTransaction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "plaza_id", length = 32, nullable = false)
    private String plazaId;

    @Column(name = "plaza_name", length = 120, nullable = false)
    private String plazaName;

    @Column(name = "vrn", length = 32, nullable = false)
    private String vrn;

    @Column(name = "tag_id", length = 64, nullable = false)
    private String tagId;

    @Column(name = "acq_txn_id", length = 32, nullable = false)
    private String acqTxnId;

    @Column(name = "toll_txn_id", length = 32, nullable = false)
    private String tollTxnId;

    @Column(name = "txn_amount", precision = 10, scale = 2, nullable = false)
    private BigDecimal txnAmount = BigDecimal.ZERO;

    @Column(name = "txn_date_time", nullable = false)
    private LocalDateTime txnDateTime;

    @Column(name = "mvc", length = 16)
    private String mvc;

    @Column(name = "avc", length = 16)
    private String avc;

    @Column(name = "audit_vc", length = 16)
    private String auditVc = "NA";

    @Column(name = "audit_remark", length = 255)
    private String auditRemark;

    @Column(name = "audit_desc", length = 255)
    private String auditDesc;

    @Column(name = "violation_img", length = 16)
    private String violationImg = "YES";

    @Column(name = "netc_txn_type", length = 32)
    private String netcTxnType = "DEBIT";

    @Column(name = "violation_api_status", length = 32, nullable = false)
    private String violationApiStatus = "ACCEPTED";

    @Column(name = "action_status", length = 32)
    private String actionStatus = "PENDING";

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    public ViolationTransaction() {}

    public ViolationTransaction(String plazaId, String plazaName, String vrn, String tagId,
                                String acqTxnId, String tollTxnId, BigDecimal txnAmount,
                                LocalDateTime txnDateTime, String mvc, String avc,
                                String auditVc, String auditRemark, String auditDesc,
                                String violationImg, String netcTxnType, String violationApiStatus) {
        this.plazaId = plazaId;
        this.plazaName = plazaName;
        this.vrn = vrn;
        this.tagId = tagId;
        this.acqTxnId = acqTxnId;
        this.tollTxnId = tollTxnId;
        this.txnAmount = txnAmount != null ? txnAmount : BigDecimal.ZERO;
        this.txnDateTime = txnDateTime;
        this.mvc = mvc;
        this.avc = avc;
        this.auditVc = auditVc != null ? auditVc : "NA";
        this.auditRemark = auditRemark;
        this.auditDesc = auditDesc;
        this.violationImg = violationImg != null ? violationImg : "YES";
        this.netcTxnType = netcTxnType != null ? netcTxnType : "DEBIT";
        this.violationApiStatus = violationApiStatus != null ? violationApiStatus : "ACCEPTED";
        this.actionStatus = "PENDING";
        this.createdAt = LocalDateTime.now();
    }

    @PrePersist
    public void prePersist() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
        if (violationImg == null) {
            violationImg = "YES";
        }
        if (netcTxnType == null) {
            netcTxnType = "DEBIT";
        }
        if (auditVc == null) {
            auditVc = "NA";
        }
        if (actionStatus == null) {
            actionStatus = "PENDING";
        }
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

    public String getVrn() {
        return vrn;
    }

    public void setVrn(String vrn) {
        this.vrn = vrn;
    }

    public String getTagId() {
        return tagId;
    }

    public void setTagId(String tagId) {
        this.tagId = tagId;
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

    public BigDecimal getTxnAmount() {
        return txnAmount;
    }

    public void setTxnAmount(BigDecimal txnAmount) {
        this.txnAmount = txnAmount;
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

    public String getAuditDesc() {
        return auditDesc;
    }

    public void setAuditDesc(String auditDesc) {
        this.auditDesc = auditDesc;
    }

    public String getViolationImg() {
        return violationImg;
    }

    public void setViolationImg(String violationImg) {
        this.violationImg = violationImg;
    }

    public String getNetcTxnType() {
        return netcTxnType;
    }

    public void setNetcTxnType(String netcTxnType) {
        this.netcTxnType = netcTxnType;
    }

    public String getViolationApiStatus() {
        return violationApiStatus;
    }

    public void setViolationApiStatus(String violationApiStatus) {
        this.violationApiStatus = violationApiStatus;
    }

    public String getActionStatus() {
        return actionStatus;
    }

    public void setActionStatus(String actionStatus) {
        this.actionStatus = actionStatus;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
