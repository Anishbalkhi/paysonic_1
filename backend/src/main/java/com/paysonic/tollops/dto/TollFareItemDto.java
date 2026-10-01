package com.paysonic.tollops.dto;

import java.math.BigDecimal;

public class TollFareItemDto {
    private String tollPlazaId;
    private String plazaName;
    private String vehicleClass;
    private String vehicleDesc;
    private BigDecimal singleJourney;
    private BigDecimal returnJourney;
    private BigDecimal monthly50Trips;
    private BigDecimal monthlyLocalUnder10km;
    private BigDecimal monthlyLocalUnder20km;
    private BigDecimal localPassCommercialFare;

    public TollFareItemDto() {}

    public TollFareItemDto(String tollPlazaId, String plazaName, String vehicleClass, String vehicleDesc,
                           BigDecimal singleJourney, BigDecimal returnJourney, BigDecimal monthly50Trips,
                           BigDecimal monthlyLocalUnder10km, BigDecimal monthlyLocalUnder20km, BigDecimal localPassCommercialFare) {
        this.tollPlazaId = tollPlazaId;
        this.plazaName = plazaName;
        this.vehicleClass = vehicleClass;
        this.vehicleDesc = vehicleDesc;
        this.singleJourney = singleJourney;
        this.returnJourney = returnJourney;
        this.monthly50Trips = monthly50Trips;
        this.monthlyLocalUnder10km = monthlyLocalUnder10km;
        this.monthlyLocalUnder20km = monthlyLocalUnder20km;
        this.localPassCommercialFare = localPassCommercialFare;
    }

    public String getTollPlazaId() {
        return tollPlazaId;
    }

    public void setTollPlazaId(String tollPlazaId) {
        this.tollPlazaId = tollPlazaId;
    }

    public String getPlazaName() {
        return plazaName;
    }

    public void setPlazaName(String plazaName) {
        this.plazaName = plazaName;
    }

    public String getVehicleClass() {
        return vehicleClass;
    }

    public void setVehicleClass(String vehicleClass) {
        this.vehicleClass = vehicleClass;
    }

    public String getVehicleDesc() {
        return vehicleDesc;
    }

    public void setVehicleDesc(String vehicleDesc) {
        this.vehicleDesc = vehicleDesc;
    }

    public BigDecimal getSingleJourney() {
        return singleJourney;
    }

    public void setSingleJourney(BigDecimal singleJourney) {
        this.singleJourney = singleJourney;
    }

    public BigDecimal getReturnJourney() {
        return returnJourney;
    }

    public void setReturnJourney(BigDecimal returnJourney) {
        this.returnJourney = returnJourney;
    }

    public BigDecimal getMonthly50Trips() {
        return monthly50Trips;
    }

    public void setMonthly50Trips(BigDecimal monthly50Trips) {
        this.monthly50Trips = monthly50Trips;
    }

    public BigDecimal getMonthlyLocalUnder10km() {
        return monthlyLocalUnder10km;
    }

    public void setMonthlyLocalUnder10km(BigDecimal monthlyLocalUnder10km) {
        this.monthlyLocalUnder10km = monthlyLocalUnder10km;
    }

    public BigDecimal getMonthlyLocalUnder20km() {
        return monthlyLocalUnder20km;
    }

    public void setMonthlyLocalUnder20km(BigDecimal monthlyLocalUnder20km) {
        this.monthlyLocalUnder20km = monthlyLocalUnder20km;
    }

    public BigDecimal getLocalPassCommercialFare() {
        return localPassCommercialFare;
    }

    public void setLocalPassCommercialFare(BigDecimal localPassCommercialFare) {
        this.localPassCommercialFare = localPassCommercialFare;
    }
}
