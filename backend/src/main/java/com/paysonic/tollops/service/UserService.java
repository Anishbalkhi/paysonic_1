package com.paysonic.tollops.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.paysonic.tollops.aspect.Auditable;
import com.paysonic.tollops.dto.CreateUserRequest;
import com.paysonic.tollops.dto.UserResponseDTO;
import com.paysonic.tollops.entity.User;
import com.paysonic.tollops.repository.UserRepository;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
public class UserService {

    private final UserRepository userRepository;
    private final ObjectMapper objectMapper;

    public static final List<String> ALL_AVAILABLE_PLAZAS = List.of(
            "NH-44 Hyderabad", "KIAL Express Plaza", "NH-48 Pune-Satara", "NH-65 Vijayawada",
            "MTHL Mumbai Sealink", "BWSL Mumbai", "DND Flyway", "Yamuna Expressway Toll 1"
    );

    public UserService(UserRepository userRepository, ObjectMapper objectMapper) {
        this.userRepository = userRepository;
        this.objectMapper = objectMapper;
    }

    public List<UserResponseDTO> getAllUsers() {
        return userRepository.findAll()
                .stream()
                .map(user -> UserResponseDTO.fromEntity(user, objectMapper))
                .collect(Collectors.toList());
    }

    public UserResponseDTO getUserById(String id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found with ID: " + id));
        return UserResponseDTO.fromEntity(user, objectMapper);
    }

    @Auditable(module = "User Management", action = "CREATE_USER", actionLabel = "Created User Profile")
    @Transactional
    public UserResponseDTO createUser(CreateUserRequest request, String actorId) {
        if (request.getEmail() != null && userRepository.findByEmail(request.getEmail()).isPresent()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Email already in use: " + request.getEmail());
        }

        String userId = request.getId() != null && !request.getId().isBlank()
                ? request.getId()
                : "PSN" + String.format("%04d", (int)(Math.random() * 9000 + 1000));

        User user = new User();
        user.setId(userId);
        user.setName(request.getName());
        user.setEmail(request.getEmail());
        user.setMobile(request.getMobile());
        user.setRole(request.getRole());
        user.setUserType(request.getUserType() != null ? request.getUserType() : "Toll Plaza");
        user.setStatus(request.getStatus() != null ? request.getStatus() : "Pending");
        user.setApproval(request.getApproval() != null ? request.getApproval() : "Pending");
        user.setLocked(request.isLocked());
        user.setCreatedBy(actorId != null ? actorId : (request.getCreatedBy() != null ? request.getCreatedBy() : "SYSTEM"));
        user.setCreatedAt(LocalDateTime.now());
        user.setUpdatedAt(LocalDateTime.now());

        // Role-based plaza assignment logic (Functional Spec v1.1 Section 5-6)
        applyPlazaRules(user, request.getRole(), request.getAssignedPlaza(), request.getPlazas());

        // Hierarchy validation (Image 1 & 3: Business Logic Rules)
        validateHierarchyAction(actorId, "CREATE", request.getRole(), request.getAssignedPlaza(), null);

        User saved = userRepository.save(user);
        return UserResponseDTO.fromEntity(saved, objectMapper);
    }

    @Auditable(module = "User Management", action = "UPDATE_USER", actionLabel = "Updated User Profile")
    @Transactional
    public UserResponseDTO updateUser(String id, CreateUserRequest request, String actorId) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found: " + id));

        // Hierarchy validation: check if actor has authority to edit this target user
        validateHierarchyAction(actorId, "MANAGE", request.getRole(), request.getAssignedPlaza(), user);

        if (request.getName() != null) user.setName(request.getName());
        if (request.getMobile() != null) user.setMobile(request.getMobile());
        if (request.getRole() != null) user.setRole(request.getRole());
        if (request.getUserType() != null) user.setUserType(request.getUserType());
        if (request.getStatus() != null) user.setStatus(request.getStatus());

        applyPlazaRules(user, user.getRole(), request.getAssignedPlaza(), request.getPlazas());

        User updated = userRepository.save(user);
        return UserResponseDTO.fromEntity(updated, objectMapper);
    }

    @Auditable(module = "User Management", action = "TOGGLE_LOCK", actionLabel = "Changed User Lock Status")
    @Transactional
    public UserResponseDTO toggleLock(String id, String actorId) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found: " + id));

        // Hierarchy validation: check if actor has authority to disable/lock this target user
        validateHierarchyAction(actorId, "MANAGE", null, null, user);

        user.setLocked(!user.isLocked());
        User updated = userRepository.save(user);
        return UserResponseDTO.fromEntity(updated, objectMapper);
    }

    @Auditable(module = "User Management", action = "APPROVE_USER", actionLabel = "Approved User Onboarding")
    @Transactional
    public UserResponseDTO approveUser(String id, String approverId) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found: " + id));

        // Enforce Maker-Checker Rule (Section 4): Creator cannot approve their own account
        if (approverId != null && approverId.equalsIgnoreCase(user.getCreatedBy())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Maker-Checker Violation: Account creator cannot approve their own user onboarding request.");
        }

        user.setApproval("Approved");
        user.setStatus("Active");
        user.setApprovedBy(approverId != null ? approverId : "Sanjay Kulkarni (PSN0005)");
        User updated = userRepository.save(user);
        return UserResponseDTO.fromEntity(updated, objectMapper);
    }

    @Auditable(module = "User Management", action = "DELETE_USER", actionLabel = "Deleted User Profile")
    @Transactional
    public void deleteUser(String id, String actorId) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found: " + id));

        // Hierarchy validation: check if actor has authority to delete this target user
        validateHierarchyAction(actorId, "MANAGE", null, null, user);

        userRepository.deleteById(id);
    }

    private void validateHierarchyAction(String actorId, String action, String targetRole, String targetPlaza, User targetUser) {
        if (actorId == null || actorId.isBlank() || "SYSTEM".equalsIgnoreCase(actorId) || "OPS_MAKER".equalsIgnoreCase(actorId)) {
            return;
        }

        User actor = userRepository.findById(actorId).orElse(null);
        if (actor == null) return;

        String actorRole = actor.getRole();
        if ("Master Admin".equalsIgnoreCase(actorRole) || "Admin".equalsIgnoreCase(actorRole)) {
            return; // Full access across all roles & plazas
        }

        if ("Concessionaire".equalsIgnoreCase(actorRole)) {
            if ("CREATE".equalsIgnoreCase(action)) {
                // Can create: Plaza admin, Request tag, Plaza POS
                List<String> allowedRoles = List.of("Plaza Admin", "Request Tag Details", "Plaza POS");
                if (targetRole == null || !allowedRoles.contains(targetRole)) {
                    throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                            "Hierarchy Violation: Concessionaire can only create Plaza Admin, Request Tag, and POS users.");
                }
            } else if ("MANAGE".equalsIgnoreCase(action) && targetUser != null) {
                // Cannot manage Master Admin, Admin, or peer Concessionaires
                if (List.of("Master Admin", "Admin", "Concessionaire").contains(targetUser.getRole())) {
                    throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                            "Hierarchy Violation: Concessionaire cannot manage administrative or peer accounts.");
                }
            }
            return;
        }

        if ("Plaza Admin".equalsIgnoreCase(actorRole)) {
            if ("CREATE".equalsIgnoreCase(action)) {
                // Can create: Request tag, Plaza POS
                List<String> allowedRoles = List.of("Request Tag Details", "Plaza POS");
                if (targetRole == null || !allowedRoles.contains(targetRole)) {
                    throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                            "Hierarchy Violation: Plaza Admin can only create Request Tag and POS users.");
                }
            } else if ("MANAGE".equalsIgnoreCase(action) && targetUser != null) {
                // Can only edit/disable Request tag and POS users it created
                boolean isCreatedByActor = actorId.equalsIgnoreCase(targetUser.getCreatedBy());
                boolean isPosOrTag = List.of("Request Tag Details", "Plaza POS").contains(targetUser.getRole());
                if (!isCreatedByActor || !isPosOrTag) {
                    throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                            "Hierarchy Violation: Plaza Admin can only edit or disable Request Tag and POS users that it created.");
                }
            }
            return;
        }

        if ("Plaza POS".equalsIgnoreCase(actorRole) || "Request Tag Details".equalsIgnoreCase(actorRole)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Hierarchy Violation: Terminal operational roles cannot create or manage user accounts.");
        }
    }

    @Auditable(module = "User Management", action = "BULK_IMPORT", actionLabel = "Imported Users via CSV")
    @Transactional(rollbackFor = Exception.class)
    public List<UserResponseDTO> bulkUpload(MultipartFile file, String actorId) {
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "CSV file is empty or missing");
        }

        List<User> newUsers = new ArrayList<>();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8));
             CSVParser csvParser = new CSVParser(reader, CSVFormat.DEFAULT.builder().setHeader().setSkipHeaderRecord(true).setTrim(true).build())) {

            for (CSVRecord record : csvParser) {
                String name = record.isMapped("name") ? record.get("name") : (record.isMapped("username") ? record.get("username") : "");
                String email = record.isMapped("email") ? record.get("email") : "";
                String mobile = record.isMapped("mobile") ? record.get("mobile") : (record.isMapped("contact") ? record.get("contact") : "");
                String role = record.isMapped("role") ? record.get("role") : "";
                String userType = record.isMapped("userType") ? record.get("userType") : (record.isMapped("user_type") ? record.get("user_type") : "Toll Plaza");
                String assignedPlaza = record.isMapped("assignedPlaza") ? record.get("assignedPlaza") : (record.isMapped("plaza") ? record.get("plaza") : "All plazas");

                if (name.isBlank() || email.isBlank() || mobile.isBlank() || role.isBlank()) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Validation failed: missing required fields on row " + record.getRecordNumber());
                }

                String userId = "PSN" + String.format("%04d", (int)(Math.random() * 9000 + 1000));
                User user = new User(userId, name, email, mobile, role, userType, assignedPlaza, "Pending", "Pending", false, actorId);
                applyPlazaRules(user, role, assignedPlaza, null);
                newUsers.add(user);
            }

            List<User> saved = userRepository.saveAll(newUsers);
            return saved.stream().map(u -> UserResponseDTO.fromEntity(u, objectMapper)).collect(Collectors.toList());

        } catch (ResponseStatusException rse) {
            throw rse;
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "All-or-Nothing Bulk Onboarding Failed: " + e.getMessage(), e);
        }
    }

    private void applyPlazaRules(User user, String role, String singlePlaza, List<String> plazaList) {
        if ("Master Admin".equalsIgnoreCase(role) || "Admin".equalsIgnoreCase(role)) {
            user.setAssignedPlaza("All plazas");
            try {
                user.setPlazasJson(objectMapper.writeValueAsString(ALL_AVAILABLE_PLAZAS));
            } catch (Exception ignored) {}
        } else if ("Bank".equalsIgnoreCase(role)) {
            user.setAssignedPlaza("None (Bank Scope)");
            user.setPlazasJson("[]");
        } else if ("Concessionaire".equalsIgnoreCase(role)) {
            if (plazaList != null && !plazaList.isEmpty()) {
                user.setAssignedPlaza(String.join(", ", plazaList));
                try {
                    user.setPlazasJson(objectMapper.writeValueAsString(plazaList));
                } catch (Exception ignored) {}
            } else {
                user.setAssignedPlaza(singlePlaza != null ? singlePlaza : "NH-44 Hyderabad");
                user.setPlazasJson("[\"" + user.getAssignedPlaza() + "\"]");
            }
        } else {
            // Toll Plaza, EV, Parking, Fuel, Other: Single plaza
            String plaza = (singlePlaza != null && !singlePlaza.isBlank()) ? singlePlaza : "NH-44 Hyderabad";
            user.setAssignedPlaza(plaza);
            user.setPlazasJson("[\"" + plaza + "\"]");
        }
    }
}
