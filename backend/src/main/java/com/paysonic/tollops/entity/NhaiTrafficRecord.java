package com.paysonic.tollops.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "nhai_traffic_reports")
public class NhaiTrafficRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "plaza_code", length = 32, nullable = false)
    private String plazaCode;

    @Column(name = "plaza_name", length = 128, nullable = false)
    private String plazaName;

    @Column(name = "report_date", nullable = false)
    private LocalDate reportDate;

    @Column(name = "vehicle_class_code", length = 20, nullable = false)
    private String vehicleClassCode; // e.g. VC4, VC20, VC5, etc.

    @Column(name = "vehicle_class_name", length = 100, nullable = false)
    private String vehicleClassName; // e.g. "VC4 - Car/Jeep/Van"

    @Column(name = "journey_type", length = 50, nullable = false)
    private String journeyType; // "Single Journey", "Return Journey", "DiscountDC", "Exempted/ Pass vehicles"

    @Column(name = "toll_fare", precision = 10, scale = 2, nullable = false)
    private BigDecimal tollFare;

    @Column(name = "transaction_count", nullable = false)
    private Long transactionCount;

    @Column(name = "transaction_amount", precision = 12, scale = 2, nullable = false)
    private BigDecimal transactionAmount;

    @Column(name = "display_order")
    private Integer displayOrder;

    @Column(name = "created_at")
    private LocalDateTime createdAt = LocalDateTime.now();

    public NhaiTrafficRecord() {}

    public NhaiTrafficRecord(
            String plazaCode, String plazaName, LocalDate reportDate,
            String vehicleClassCode, String vehicleClassName, String journeyType,
            BigDecimal tollFare, Long transactionCount, BigDecimal transactionAmount,
            Integer displayOrder) {
        this.plazaCode = plazaCode;
        this.plazaName = plazaName;
        this.reportDate = reportDate;
        this.vehicleClassCode = vehicleClassCode;
        this.vehicleClassName = vehicleClassName;
        this.journeyType = journeyType;
        this.tollFare = tollFare;
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

    public String getPlazaCode() {
        return plazaCode;
    }

    public void setPlazaCode(String plazaCode) {
        this.plazaCode = plazaCode;
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

    public String getVehicleClassCode() {
        return vehicleClassCode;
    }

    public void setVehicleClassCode(String vehicleClassCode) {
        this.vehicleClassCode = vehicleClassCode;
    }

    public String getVehicleClassName() {
        return vehicleClassName;
    }

    public void setVehicleClassName(String vehicleClassName) {
        this.vehicleClassName = vehicleClassName;
    }

    public String getJourneyType() {
        return journeyType;
    }

    public void setJourneyType(String journeyType) {
        this.journeyType = journeyType;
    }

    public BigDecimal getTollFare() {
        return tollFare;
    }

    public void setTollFare(BigDecimal tollFare) {
        this.tollFare = tollFare;
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
