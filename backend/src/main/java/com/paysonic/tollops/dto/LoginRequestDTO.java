package com.paysonic.tollops.dto;

public class LoginRequestDTO {

    private String email;
    private String password;
    private String deviceId;
    private String plaza;

    public LoginRequestDTO() {}

    public LoginRequestDTO(String email, String password, String deviceId, String plaza) {
        this.email = email;
        this.password = password;
        this.deviceId = deviceId;
        this.plaza = plaza;
    }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }

    public String getDeviceId() { return deviceId; }
    public void setDeviceId(String deviceId) { this.deviceId = deviceId; }

    public String getPlaza() { return plaza; }
    public void setPlaza(String plaza) { this.plaza = plaza; }
}
