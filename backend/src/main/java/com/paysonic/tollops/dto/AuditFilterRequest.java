package com.paysonic.tollops.dto;

public class AuditFilterRequest {
    private String search;
    private String module;
    private String status;
    private String plaza;
    private String actorId;
    private String dateRange;
    private String format = "csv";

    public AuditFilterRequest() {}

    public String getSearch() { return search; }
    public void setSearch(String search) { this.search = search; }

    public String getModule() { return module; }
    public void setModule(String module) { this.module = module; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getPlaza() { return plaza; }
    public void setPlaza(String plaza) { this.plaza = plaza; }

    public String getActorId() { return actorId; }
    public void setActorId(String actorId) { this.actorId = actorId; }

    public String getDateRange() { return dateRange; }
    public void setDateRange(String dateRange) { this.dateRange = dateRange; }

    public String getFormat() { return format; }
    public void setFormat(String format) { this.format = format; }
}
