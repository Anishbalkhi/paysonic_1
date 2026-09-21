package com.paysonic.tollops.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.paysonic.tollops.entity.User;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

public class UserResponseDTO {

    private String id;
    private String name;
    private String email;
    private String mobile;
    private String role;
    private String userType;
    private String assignedPlaza;
    private List<String> plazas = new ArrayList<>();
    private String status;
    private String approval;
    private boolean locked;
    private String avatar;
    
    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime lastActive;

    private String createdBy;
    private String approvedBy;

    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime createdAt;

    public static UserResponseDTO fromEntity(User user, ObjectMapper objectMapper) {
        UserResponseDTO dto = new UserResponseDTO();
        dto.setId(user.getId());
        dto.setName(user.getName());
        dto.setEmail(user.getEmail());
        dto.setMobile(user.getMobile());
        dto.setRole(user.getRole());
        dto.setUserType(user.getUserType());
        dto.setAssignedPlaza(user.getAssignedPlaza());
        dto.setStatus(user.getStatus());
        dto.setApproval(user.getApproval());
        dto.setLocked(user.isLocked());
        dto.setAvatar(user.getAvatar());
        dto.setLastActive(user.getLastActive());
        dto.setCreatedBy(user.getCreatedBy());
        dto.setApprovedBy(user.getApprovedBy());
        dto.setCreatedAt(user.getCreatedAt());

        if (user.getPlazasJson() != null && !user.getPlazasJson().isBlank()) {
            try {
                dto.setPlazas(objectMapper.readValue(user.getPlazasJson(), new TypeReference<List<String>>() {}));
            } catch (Exception e) {
                dto.setPlazas(List.of(user.getAssignedPlaza() != null ? user.getAssignedPlaza() : "All plazas"));
            }
        } else if (user.getAssignedPlaza() != null) {
            dto.setPlazas(List.of(user.getAssignedPlaza()));
        }

        return dto;
    }

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

    public String getAvatar() { return avatar; }
    public void setAvatar(String avatar) { this.avatar = avatar; }

    public LocalDateTime getLastActive() { return lastActive; }
    public void setLastActive(LocalDateTime lastActive) { this.lastActive = lastActive; }

    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }

    public String getApprovedBy() { return approvedBy; }
    public void setApprovedBy(String approvedBy) { this.approvedBy = approvedBy; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
