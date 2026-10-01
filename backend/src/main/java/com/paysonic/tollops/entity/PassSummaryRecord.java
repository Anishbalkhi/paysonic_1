package com.paysonic.tollops.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "pass_summary_reports")
public class PassSummaryRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "plaza_id", length = 32, nullable = false)
    private String plazaId;

    @Column(name = "plaza_name", length = 128, nullable = false)
    private String plazaName;

    @Column(name = "report_date", nullable = false)
    private LocalDate reportDate;

    @Column(name = "payment_mode", length = 50, nullable = false)
    private String paymentMode; // "Cash", "Online"

    @Column(name = "pass_type", length = 100, nullable = false)
    private String passType; // "Monthly Regular", "Monthly Exempted", "Local 10km", "Local 20km"

    @Column(name = "pass_count", nullable = false)
    private Long passCount;

    @Column(name = "pass_amount", precision = 14, scale = 2, nullable = false)
    private BigDecimal passAmount;

    @Column(name = "display_order")
    private Integer displayOrder;

    @Column(name = "created_at")
    private LocalDateTime createdAt = LocalDateTime.now();

    public PassSummaryRecord() {}

    public PassSummaryRecord(
            String plazaId, String plazaName, LocalDate reportDate,
            String paymentMode, String passType,
            Long passCount, BigDecimal passAmount,
            Integer displayOrder) {
        this.plazaId = plazaId;
        this.plazaName = plazaName;
        this.reportDate = reportDate;
        this.paymentMode = paymentMode;
        this.passType = passType;
        this.passCount = passCount;
        this.passAmount = passAmount;
        this.displayOrder = displayOrder;
        this.createdAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getPlazaId() { return plazaId; }
    public void setPlazaId(String plazaId) { this.plazaId = plazaId; }

    public String getPlazaName() { return plazaName; }
    public void setPlazaName(String plazaName) { this.plazaName = plazaName; }

    public LocalDate getReportDate() { return reportDate; }
    public void setReportDate(LocalDate reportDate) { this.reportDate = reportDate; }

    public String getPaymentMode() { return paymentMode; }
    public void setPaymentMode(String paymentMode) { this.paymentMode = paymentMode; }

    public String getPassType() { return passType; }
    public void setPassType(String passType) { this.passType = passType; }

    public Long getPassCount() { return passCount; }
    public void setPassCount(Long passCount) { this.passCount = passCount; }

    public BigDecimal getPassAmount() { return passAmount; }
    public void setPassAmount(BigDecimal passAmount) { this.passAmount = passAmount; }

    public Integer getDisplayOrder() { return displayOrder; }
    public void setDisplayOrder(Integer displayOrder) { this.displayOrder = displayOrder; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
