package com.paysonic.tollops.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.paysonic.tollops.entity.User;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

public class UserResponseDTO {

    private String id;
    private String username;
    private String name;
    private String email;
    private String mobile;
    private String role;
    private String userType;
    private String assignedPlaza;
    private List<String> plazas = new ArrayList<>();
    private List<String> menuAccess = new ArrayList<>();
    private String status;
    private String approval;
    private boolean locked;
    private boolean dormant;
    private String avatar;
    private String password;
    
    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime lastActive;

    private String createdBy;
    private String approvedBy;

    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime createdAt;

    public static UserResponseDTO fromEntity(User user, ObjectMapper objectMapper) {
        UserResponseDTO dto = new UserResponseDTO();
        dto.setId(user.getId());
        dto.setUsername(user.getUsername() != null && !user.getUsername().isBlank() ? user.getUsername() : user.getId());
        dto.setName(user.getName());
        dto.setEmail(user.getEmail());
        dto.setMobile(user.getMobile());
        dto.setRole(user.getRole());
        dto.setUserType(user.getUserType());
        dto.setAssignedPlaza(user.getAssignedPlaza());
        dto.setStatus(user.getStatus());
        dto.setApproval(user.getApproval());
        dto.setAvatar(user.getAvatar());
        dto.setPassword(user.getPassword() != null && !user.getPassword().isBlank() ? user.getPassword() : "Paysonic@2026");
        dto.setLastActive(user.getLastActive());
        dto.setCreatedBy(user.getCreatedBy());
        dto.setApprovedBy(user.getApprovedBy());
        dto.setCreatedAt(user.getCreatedAt());

        // 72-Hour Dormancy Check: User becomes dormant (locked) if not logged in for 72 hours
        LocalDateTime refTime = user.getLastActive() != null ? user.getLastActive() : user.getCreatedAt();
        boolean isTrash = "Trash User".equalsIgnoreCase(user.getStatus()) || "Trash".equalsIgnoreCase(user.getStatus());
        boolean isDormant = !isTrash && !"Master Admin".equalsIgnoreCase(user.getRole()) &&
                refTime != null &&
                refTime.isBefore(LocalDateTime.now().minusHours(72));
        dto.setDormant(isDormant);
        dto.setLocked(user.isLocked() || isDormant);

        List<String> rawPlazas = new ArrayList<>();
        if (user.getPlazasJson() != null && !user.getPlazasJson().isBlank()) {
            try {
                rawPlazas = objectMapper.readValue(user.getPlazasJson(), new TypeReference<List<String>>() {});
            } catch (Exception e) {
                if (user.getAssignedPlaza() != null) rawPlazas = List.of(user.getAssignedPlaza());
            }
        } else if (user.getAssignedPlaza() != null) {
            rawPlazas = List.of(user.getAssignedPlaza());
        }

        List<String> cleanPlazas = rawPlazas.stream()
                .flatMap(p -> Arrays.stream(p.split(",")))
                .map(String::trim)
                .filter(s -> !s.isBlank())
                .distinct()
                .collect(Collectors.toList());
        dto.setPlazas(cleanPlazas);

        if (user.getMenuAccessJson() != null && !user.getMenuAccessJson().isBlank()) {
            try {
                dto.setMenuAccess(objectMapper.readValue(user.getMenuAccessJson(), new TypeReference<List<String>>() {}));
            } catch (Exception e) {
                dto.setMenuAccess(new ArrayList<>());
            }
        }

        return dto;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }

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

    public List<String> getMenuAccess() { return menuAccess; }
    public void setMenuAccess(List<String> menuAccess) { this.menuAccess = menuAccess; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getApproval() { return approval; }
    public void setApproval(String approval) { this.approval = approval; }

    public boolean isLocked() { return locked; }
    public void setLocked(boolean locked) { this.locked = locked; }

    public boolean isDormant() { return dormant; }
    public void setDormant(boolean dormant) { this.dormant = dormant; }

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

    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }
}
