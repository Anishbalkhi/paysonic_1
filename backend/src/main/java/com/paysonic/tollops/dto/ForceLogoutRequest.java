package com.paysonic.tollops.dto;

public class ForceLogoutRequest {
    private String reason = "Administrative revocation";

    public ForceLogoutRequest() {}

    public ForceLogoutRequest(String reason) {
        this.reason = reason;
    }

    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
}
