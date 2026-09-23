package com.paysonic.tollops.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import java.util.List;

public class CreateUserRequest {

    private String id;

    @NotBlank(message = "Name is required")
    private String name;

    @NotBlank(message = "Email is required")
    @Email(message = "Invalid email format")
    private String email;

    @NotBlank(message = "Mobile number is required")
    private String mobile;

    @NotBlank(message = "Role is required")
    private String role;

    private String userType = "Toll Plaza";
    private String assignedPlaza;
    private List<String> plazas;
    private String status = "Pending";
    private String approval = "Pending";
    private boolean locked = false;
    private String createdBy = "SYSTEM";

    public CreateUserRequest() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getMobile() { return mobile; }
    public void setMobile(String mobile) { this.mobile = mobile; }

    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }

    public String getUserType() { return userType; }
    public void setUserType(String userType) { this.userType = userType; }

    public String getAssignedPlaza() { return assignedPlaza; }
    public void setAssignedPlaza(String assignedPlaza) { this.assignedPlaza = assignedPlaza; }

    public List<String> getPlazas() { return plazas; }
    public void setPlazas(List<String> plazas) { this.plazas = plazas; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getApproval() { return approval; }
    public void setApproval(String approval) { this.approval = approval; }

    public boolean isLocked() { return locked; }
    public void setLocked(boolean locked) { this.locked = locked; }

    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }
}
