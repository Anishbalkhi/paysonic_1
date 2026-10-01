package com.paysonic.tollops.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "violation_validate_reports")
public class ViolationValidateRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "sr_no")
    private Integer srNo;

    @Column(name = "take_action", length = 50)
    private String takeAction; // "Actioned", "View Violation"

    @Column(name = "plaza_id", length = 32)
    private String plazaId;

    @Column(name = "plaza_name", length = 128)
    private String plazaName;

    @Column(name = "vrn", length = 32)
    private String vrn;

    @Column(name = "tag_id", length = 64)
    private String tagId;

    @Column(name = "acq_txn_id", length = 64)
    private String acqTxnId;

    @Column(name = "toll_txn_id", length = 64)
    private String tollTxnId;

    @Column(name = "txn_amount", precision = 12, scale = 2)
    private BigDecimal txnAmount;

    @Column(name = "txn_date_time")
    private LocalDateTime txnDateTime;

    @Column(name = "mvc", length = 20)
    private String mvc;

    @Column(name = "avc", length = 20)
    private String avc;

    @Column(name = "audit_vc", length = 20)
    private String auditVc;

    @Column(name = "audit_remark", length = 50)
    private String auditRemark; // "ACCEPTED", "DECLINED", etc.

    @Column(name = "audit_desc", length = 255)
    private String auditDesc;

    @Column(name = "violation_img", length = 10)
    private String violationImg; // "YES" / "NO"

    @Column(name = "netc_txn_type", length = 20)
    private String netcTxnType; // "DEBIT"

    @Column(name = "violation_api_status", length = 50)
    private String violationApiStatus; // "APPROVED", "REJECTED"

    @Column(name = "created_at")
    private LocalDateTime createdAt = LocalDateTime.now();

    public ViolationValidateRecord() {}

    public ViolationValidateRecord(
            Integer srNo, String takeAction, String plazaId, String plazaName, String vrn,
            String tagId, String acqTxnId, String tollTxnId, BigDecimal txnAmount,
            LocalDateTime txnDateTime, String mvc, String avc, String auditVc,
            String auditRemark, String auditDesc, String violationImg,
            String netcTxnType, String violationApiStatus) {
        this.srNo = srNo;
        this.takeAction = takeAction;
        this.plazaId = plazaId;
        this.plazaName = plazaName;
        this.vrn = vrn;
        this.tagId = tagId;
        this.acqTxnId = acqTxnId;
        this.tollTxnId = tollTxnId;
        this.txnAmount = txnAmount;
        this.txnDateTime = txnDateTime;
        this.mvc = mvc;
        this.avc = avc;
        this.auditVc = auditVc;
        this.auditRemark = auditRemark;
        this.auditDesc = auditDesc;
        this.violationImg = violationImg;
        this.netcTxnType = netcTxnType;
        this.violationApiStatus = violationApiStatus;
        this.createdAt = LocalDateTime.now();
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Integer getSrNo() {
        return srNo;
    }

    public void setSrNo(Integer srNo) {
        this.srNo = srNo;
    }

    public String getTakeAction() {
        return takeAction;
    }

    public void setTakeAction(String takeAction) {
        this.takeAction = takeAction;
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

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
