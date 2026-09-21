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
        user.setStatus(request.getStatus() != null ? request.getStatus() : "Active");
        user.setApproval(request.getApproval() != null ? request.getApproval() : "Pending");
        user.setLocked(request.isLocked());
        user.setCreatedBy(actorId != null ? actorId : (request.getCreatedBy() != null ? request.getCreatedBy() : "SYSTEM"));
        user.setCreatedAt(LocalDateTime.now());
        user.setUpdatedAt(LocalDateTime.now());

        // Role-based plaza assignment logic (Functional Spec v1.1 Section 5-6)
        applyPlazaRules(user, request.getRole(), request.getAssignedPlaza(), request.getPlazas());

        User saved = userRepository.save(user);
        return UserResponseDTO.fromEntity(saved, objectMapper);
    }

    @Auditable(module = "User Management", action = "UPDATE_USER", actionLabel = "Updated User Profile")
    @Transactional
    public UserResponseDTO updateUser(String id, CreateUserRequest request) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found: " + id));

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
    public UserResponseDTO toggleLock(String id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found: " + id));

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
        user.setApprovedBy(approverId != null ? approverId : "Sanjay Kulkarni (PSN0005)");
        User updated = userRepository.save(user);
        return UserResponseDTO.fromEntity(updated, objectMapper);
    }

    @Auditable(module = "User Management", action = "DELETE_USER", actionLabel = "Deleted User Profile")
    @Transactional
    public void deleteUser(String id) {
        if (!userRepository.existsById(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found: " + id);
        }
        userRepository.deleteById(id);
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
                String name = record.get("name");
                String email = record.get("email");
                String mobile = record.get("mobile");
                String role = record.get("role");
                String userType = record.isMapped("userType") ? record.get("userType") : "Toll Plaza";
                String assignedPlaza = record.isMapped("assignedPlaza") ? record.get("assignedPlaza") : "NH-44 Hyderabad";

                if (name.isBlank() || email.isBlank() || mobile.isBlank() || role.isBlank()) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Validation failed: missing required fields on row " + record.getRecordNumber());
                }

                String userId = "PSN" + String.format("%04d", (int)(Math.random() * 9000 + 1000));
                User user = new User(userId, name, email, mobile, role, userType, assignedPlaza, "Active", "Pending", false, actorId);
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
