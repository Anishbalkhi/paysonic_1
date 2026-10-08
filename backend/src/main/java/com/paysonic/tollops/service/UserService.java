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
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import com.paysonic.tollops.entity.Plaza;
import com.paysonic.tollops.entity.UserSession;
import com.paysonic.tollops.repository.PlazaRepository;
import com.paysonic.tollops.repository.UserSessionRepository;

@Service
public class UserService {

    private final UserRepository userRepository;
    private final PlazaRepository plazaRepository;
    private final UserSessionRepository userSessionRepository;
    private final ObjectMapper objectMapper;

    public static final List<String> ALL_AVAILABLE_PLAZAS = List.of(
            "MUMBAI PLAZA NH-04", "PUNE BYPASS PLAZA", "NASHIK TOLL PLAZA", "KOLHAPUR PLAZA", "SOLAPUR PLAZA NH-65"
    );

    public UserService(UserRepository userRepository, PlazaRepository plazaRepository,
                       UserSessionRepository userSessionRepository, ObjectMapper objectMapper) {
        this.userRepository = userRepository;
        this.plazaRepository = plazaRepository;
        this.userSessionRepository = userSessionRepository;
        this.objectMapper = objectMapper;
    }

    public List<UserResponseDTO> getAllUsers() {
        return userRepository.findAll()
                .stream()
                .peek(this::checkAndApplyDormancy)
                .sorted((a, b) -> {
                    if (a.getCreatedAt() != null && b.getCreatedAt() != null) {
                        return b.getCreatedAt().compareTo(a.getCreatedAt());
                    }
                    if (a.getCreatedAt() != null) return -1;
                    if (b.getCreatedAt() != null) return 1;
                    return b.getId().compareTo(a.getId());
                })
                .map(user -> UserResponseDTO.fromEntity(user, objectMapper))
                .collect(Collectors.toList());
    }

    public Map<String, Object> getPagedUsers(int page, int size, String search, String role, String status, String plaza) {
        List<User> all = userRepository.findAll();
        all.forEach(this::checkAndApplyDormancy);
        all.sort((a, b) -> {
            if (a.getCreatedAt() != null && b.getCreatedAt() != null) {
                return b.getCreatedAt().compareTo(a.getCreatedAt());
            }
            if (a.getCreatedAt() != null) return -1;
            if (b.getCreatedAt() != null) return 1;
            return b.getId().compareTo(a.getId());
        });

        Stream<User> stream = all.stream();

        if (search != null && !search.isBlank()) {
            String s = search.toLowerCase().trim();
            stream = stream.filter(u ->
                    (u.getName() != null && u.getName().toLowerCase().contains(s)) ||
                    (u.getMobile() != null && u.getMobile().toLowerCase().contains(s)) ||
                    (u.getId() != null && u.getId().toLowerCase().contains(s)) ||
                    (u.getEmail() != null && u.getEmail().toLowerCase().contains(s))
            );
        }
        if (role != null && !role.isBlank() && !"All roles".equalsIgnoreCase(role)) {
            stream = stream.filter(u -> u.getRole() != null && u.getRole().equalsIgnoreCase(role));
        }
        if (status != null && !status.isBlank() && !"All statuses".equalsIgnoreCase(status)) {
            if ("Pending".equalsIgnoreCase(status)) {
                stream = stream.filter(u -> ("Pending".equalsIgnoreCase(u.getApproval()) || "Pending".equalsIgnoreCase(u.getStatus())) && !"Trash User".equalsIgnoreCase(u.getStatus()) && !"Trash".equalsIgnoreCase(u.getStatus()));
            } else if ("Locked".equalsIgnoreCase(status)) {
                stream = stream.filter(u -> u.isLocked() && !"Trash User".equalsIgnoreCase(u.getStatus()) && !"Trash".equalsIgnoreCase(u.getStatus()));
            } else if ("Active".equalsIgnoreCase(status)) {
                stream = stream.filter(u -> "Active".equalsIgnoreCase(u.getStatus()) && "Approved".equalsIgnoreCase(u.getApproval()) && !u.isLocked());
            } else if ("Inactive".equalsIgnoreCase(status)) {
                stream = stream.filter(u -> "Inactive".equalsIgnoreCase(u.getStatus()));
            } else if ("Trash User".equalsIgnoreCase(status) || "Trash".equalsIgnoreCase(status)) {
                stream = stream.filter(u -> "Trash User".equalsIgnoreCase(u.getStatus()) || "Trash".equalsIgnoreCase(u.getStatus()));
            } else {
                stream = stream.filter(u -> u.getStatus() != null && u.getStatus().equalsIgnoreCase(status));
            }
        } else {
            // Default "All statuses" excludes Trash Users
            stream = stream.filter(u -> !"Trash User".equalsIgnoreCase(u.getStatus()) && !"Trash".equalsIgnoreCase(u.getStatus()));
        }
        if (plaza != null && !plaza.isBlank() && !"All plazas".equalsIgnoreCase(plaza)) {
            String p = plaza.toLowerCase();
            stream = stream.filter(u ->
                    (u.getAssignedPlaza() != null && u.getAssignedPlaza().toLowerCase().contains(p)) ||
                    (u.getPlazasJson() != null && u.getPlazasJson().toLowerCase().contains(p))
            );
        }

        List<User> filtered = stream.collect(Collectors.toList());
        int totalElements = filtered.size();
        int totalPages = (int) Math.ceil((double) totalElements / size);
        if (totalPages == 0) totalPages = 1;

        int fromIndex = Math.min(page * size, totalElements);
        int toIndex = Math.min(fromIndex + size, totalElements);
        List<UserResponseDTO> pageContent = filtered.subList(fromIndex, toIndex).stream()
                .map(u -> UserResponseDTO.fromEntity(u, objectMapper))
                .collect(Collectors.toList());

        return Map.of(
                "content", pageContent,
                "totalElements", totalElements,
                "totalPages", totalPages,
                "currentPage", page,
                "pageSize", size
        );
    }

    public UserResponseDTO getUserById(String id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found with ID: " + id));
        checkAndApplyDormancy(user);
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

        // Requirement #9: Username is auto-generated in PSN format for database display and management
        String username = request.getUsername() != null && !request.getUsername().isBlank()
                ? request.getUsername()
                : userId;

        User user = new User();
        user.setId(userId);
        user.setUsername(username);
        user.setName(request.getName());
        user.setEmail(request.getEmail());
        user.setMobile(request.getMobile());
        user.setRole(request.getRole());
        // Active / Auto-Approved status support:
        boolean isAutoApproved = "Active".equalsIgnoreCase(request.getStatus())
                || "Auto Approved".equalsIgnoreCase(request.getStatus())
                || "Approved".equalsIgnoreCase(request.getApproval())
                || "Auto-Approved".equalsIgnoreCase(request.getStatus());

        if (isAutoApproved) {
            user.setStatus("Active");
            user.setApproval("Approved");
            User creator = findActor(actorId);
            String approverName = creator != null ? creator.getName() + " (" + creator.getId() + ")" : (actorId != null ? actorId : "SYSTEM");
            user.setApprovedBy(approverName);
        } else {
            user.setStatus("Pending");
            user.setApproval("Pending");
        }
        user.setLocked(false);
        user.setCreatedBy(actorId != null ? actorId : (request.getCreatedBy() != null ? request.getCreatedBy() : "SYSTEM"));
        user.setCreatedAt(LocalDateTime.now());
        user.setUpdatedAt(LocalDateTime.now());
        user.setLastActive(LocalDateTime.now());

        // Role-based plaza assignment logic (Functional Spec v1.1 Section 5-6)
        applyPlazaRules(user, request.getRole(), request.getAssignedPlaza(), request.getPlazas());

        user.setPassword(request.getPassword() != null && !request.getPassword().isBlank() ? request.getPassword() : "Paysonic@2026");

        if (request.getMenuAccess() != null) {
            try {
                user.setMenuAccessJson(objectMapper.writeValueAsString(request.getMenuAccess()));
            } catch (Exception ignored) {}
        }

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
        boolean isSelf = (actorId != null && (
                actorId.equalsIgnoreCase(user.getId()) ||
                (user.getEmail() != null && actorId.equalsIgnoreCase(user.getEmail())) ||
                (user.getName() != null && actorId.equalsIgnoreCase(user.getName()))
        ));
        if (!isSelf) {
            validateHierarchyAction(actorId, "MANAGE", request.getRole(), request.getAssignedPlaza(), user);
        }

        if (request.getName() != null) user.setName(request.getName());
        if (request.getUsername() != null && !request.getUsername().isBlank()) user.setUsername(request.getUsername());
        if (request.getMobile() != null) user.setMobile(request.getMobile());
        if (request.getRole() != null) user.setRole(request.getRole());
        if (request.getUserType() != null) user.setUserType(request.getUserType());
        if (request.getStatus() != null) {
            // Unapproved users cannot be switched to Active without hierarchy approval
            if ("Pending".equalsIgnoreCase(user.getApproval()) && "Active".equalsIgnoreCase(request.getStatus())) {
                user.setStatus("Pending");
            } else {
                user.setStatus(request.getStatus());
                if ("Active".equalsIgnoreCase(request.getStatus()) && user.isLocked()) {
                    user.setLocked(false);
                }
            }
        }
        if (request.getPassword() != null && !request.getPassword().isBlank()) {
            user.setPassword(request.getPassword());
        }

        if (request.getMenuAccess() != null) {
            try {
                user.setMenuAccessJson(objectMapper.writeValueAsString(request.getMenuAccess()));
            } catch (Exception ignored) {}
        }

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

        boolean willBeLocked = !user.isLocked();
        user.setLocked(willBeLocked);
        if (!willBeLocked) {
            // Unlocking user (including dormant accounts): reset lastActive to current time
            user.setLastActive(LocalDateTime.now());
        }
        user.setUpdatedAt(LocalDateTime.now());
        User updated = userRepository.save(user);
        return UserResponseDTO.fromEntity(updated, objectMapper);
    }

    @Auditable(module = "User Management", action = "APPROVE_USER", actionLabel = "Approved User Onboarding")
    @Transactional
    public UserResponseDTO approveUser(String id, String approverId) {
        if (approverId == null || approverId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Approver actor ID is required.");
        }

        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found: " + id));

        // Bug Fix 4: Check if user is already approved
        if ("Approved".equalsIgnoreCase(user.getApproval())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "User is already approved. Cannot re-approve an approved account.");
        }

        // Rule A: A user cannot approve their own account
        if (approverId.equalsIgnoreCase(user.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Hierarchy Violation: A user cannot approve their own registration account.");
        }

        User approver = findActor(approverId);

        // Hierarchy validation: check if approver has authority to approve this target user
        validateHierarchyAction(approverId, "APPROVE", user.getRole(), user.getAssignedPlaza(), user);

        user.setApproval("Approved");
        user.setStatus("Active");

        String approverName = approver != null ? approver.getName() + " (" + approver.getId() + ")" : approverId;
        user.setApprovedBy(approverName);
        User updated = userRepository.save(user);
        return UserResponseDTO.fromEntity(updated, objectMapper);
    }

    @Auditable(module = "User Management", action = "DELETE_USER", actionLabel = "Moved User to Trash")
    @Transactional
    public void deleteUser(String id, String actorId) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found: " + id));

        // Hierarchy validation: check if actor has authority to delete this target user
        validateHierarchyAction(actorId, "MANAGE", null, null, user);

        // Requirement #8: Deleted user should store in trash user - status trash user (it should not get deleted from database)
        user.setStatus("Trash User");
        user.setLocked(true);
        user.setUpdatedAt(LocalDateTime.now());
        userRepository.save(user);

        // Terminate any active sessions for this user
        try {
            List<UserSession> sessions = userSessionRepository.findByUserId(id);
            if (sessions != null && !sessions.isEmpty()) {
                userSessionRepository.deleteAll(sessions);
            }
        } catch (Exception ignored) {}
    }

    @Auditable(module = "User Management", action = "ACTIVATE_USER", actionLabel = "Activated User from Trash")
    @Transactional
    public UserResponseDTO activateUser(String id, String actorId) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found: " + id));

        // Hierarchy validation: check if actor has authority to manage this target user
        validateHierarchyAction(actorId, "MANAGE", null, null, user);

        // Requirement #8: If required we can active the user
        user.setStatus("Active");
        user.setLocked(false);
        user.setApproval("Approved");
        user.setLastActive(LocalDateTime.now());
        user.setUpdatedAt(LocalDateTime.now());
        User updated = userRepository.save(user);
        return UserResponseDTO.fromEntity(updated, objectMapper);
    }

    private User findActor(String actorId) {
        if (actorId == null || actorId.isBlank()) return null;
        return userRepository.findById(actorId)
                .or(() -> userRepository.findByEmailIgnoreCase(actorId))
                .or(() -> userRepository.findByNameIgnoreCase(actorId))
                .orElse(null);
    }

    private void validateHierarchyAction(String actorId, String action, String targetRole, String targetPlaza, User targetUser) {
        if (actorId == null || actorId.isBlank() || "SYSTEM".equalsIgnoreCase(actorId) || "OPS_MAKER".equalsIgnoreCase(actorId)) {
            return;
        }

        User actor = findActor(actorId);
        if (actor == null) return;

        // Self-action: A user is always authorized to update their own credentials/profile
        if (targetUser != null && (
                actor.getId().equalsIgnoreCase(targetUser.getId()) ||
                (actor.getEmail() != null && targetUser.getEmail() != null && actor.getEmail().equalsIgnoreCase(targetUser.getEmail()))
        )) {
            if ("DELETE".equalsIgnoreCase(action)) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Users cannot delete their own account.");
            }
            if ("APPROVE".equalsIgnoreCase(action)) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Users cannot approve their own account.");
            }
            return; // Permitted: self update / password change
        }

        String actorRole = actor.getRole();

        // Bug Fix 5: Verify fine-grained user_management_approve_user permission if action is APPROVE
        if (!"Master Admin".equalsIgnoreCase(actorRole) && "APPROVE".equalsIgnoreCase(action)) {
            if (!hasApprovePermission(actor)) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                        "Permission Denied: Actor does not possess the 'user_management_approve_user' permission.");
            }
        }

        if ("Master Admin".equalsIgnoreCase(actorRole)) {
            if (targetUser != null && "Master Admin".equalsIgnoreCase(targetUser.getRole())) {
                if ("DELETE".equalsIgnoreCase(action)) {
                    boolean isRoot = "masteradmin@paysonic.com".equalsIgnoreCase(actor.getEmail());
                    if (!isRoot) {
                        throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                                "Hierarchy Violation: Only root Master Admin (masteradmin@paysonic.com) can delete Master Admin accounts.");
                    }
                }
                return; // Allowed: Master Admin can approve, edit, and configure peer Master Admin accounts
            }
            if ("CREATE".equalsIgnoreCase(action) && "Master Admin".equalsIgnoreCase(targetRole)) {
                return; // Allowed: Master Admin can create another Master Admin
            }
            return; // Full access across all subordinate roles & plazas
        }

        if ("Admin".equalsIgnoreCase(actorRole)) {
            // Cannot create, manage, approve, or delete Master Admin or Admin accounts
            boolean isMasterOrAdminTarget = "Master Admin".equalsIgnoreCase(targetRole)
                    || "Admin".equalsIgnoreCase(targetRole)
                    || (targetUser != null && ("Master Admin".equalsIgnoreCase(targetUser.getRole()) || "Admin".equalsIgnoreCase(targetUser.getRole())));
            if (isMasterOrAdminTarget) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                        "Hierarchy Violation: Admin cannot create, modify, approve, or delete Admin or Master Admin accounts.");
            }
            return;
        }

        if ("Concessionaire".equalsIgnoreCase(actorRole)) {
            if ("CREATE".equalsIgnoreCase(action)) {
                // Can create: Plaza admin, Request tag, Plaza POS
                List<String> allowedRoles = List.of("Plaza Admin", "Request Tag Details", "Plaza POS");
                if (targetRole == null || !allowedRoles.contains(targetRole)) {
                    throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                            "Hierarchy Violation: Concessionaire can only create Plaza Admin, Request Tag, and POS users.");
                }
                if (!hasPlazaOverlap(actor, null, targetPlaza)) {
                    throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                            "Plaza Scope Violation: Concessionaire can only create users within their assigned plazas.");
                }
            } else if (("MANAGE".equalsIgnoreCase(action) || "APPROVE".equalsIgnoreCase(action)) && targetUser != null) {
                // Cannot manage or approve Master Admin, Admin, or peer Concessionaires
                if (List.of("Master Admin", "Admin", "Concessionaire").contains(targetUser.getRole())) {
                    throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                            "Hierarchy Violation: Concessionaire cannot manage or approve administrative or peer accounts.");
                }
                List<String> allowedRoles = List.of("Plaza Admin", "Request Tag Details", "Plaza POS");
                if (!allowedRoles.contains(targetUser.getRole())) {
                    throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                            "Hierarchy Violation: Concessionaire can only approve or manage Plaza Admin, Request Tag, and POS users.");
                }
                // Bug Fix 2: Check Concessionaire plaza scope on APPROVE/MANAGE
                if (!hasPlazaOverlap(actor, targetUser, targetPlaza)) {
                    throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                            "Plaza Scope Violation: Concessionaire can only approve or manage users within their assigned plazas.");
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
                if (!hasPlazaOverlap(actor, null, targetPlaza)) {
                    throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                            "Plaza Scope Violation: Plaza Admin can only create users within their assigned plaza.");
                }
            } else if ("APPROVE".equalsIgnoreCase(action) && targetUser != null) {
                // Plaza Admin can approve subordinate roles: Request Tag Details, Plaza POS
                List<String> allowedRoles = List.of("Request Tag Details", "Plaza POS");
                if (!allowedRoles.contains(targetUser.getRole())) {
                    throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                            "Hierarchy Violation: Plaza Admin can only approve Request Tag and POS users.");
                }
                // Bug Fix 2: Check Plaza Admin plaza scope on APPROVE
                if (!hasPlazaOverlap(actor, targetUser, targetPlaza)) {
                    throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                            "Plaza Scope Violation: Plaza Admin can only approve users within their assigned plaza.");
                }
            } else if ("MANAGE".equalsIgnoreCase(action) && targetUser != null) {
                // Can only edit/disable Request tag and POS users it created
                boolean isCreatedByActor = actorId.equalsIgnoreCase(targetUser.getCreatedBy());
                boolean isPosOrTag = List.of("Request Tag Details", "Plaza POS").contains(targetUser.getRole());
                if (!isCreatedByActor || !isPosOrTag) {
                    throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                            "Hierarchy Violation: Plaza Admin can only edit or disable Request Tag and POS users that it created.");
                }
                if (!hasPlazaOverlap(actor, targetUser, targetPlaza)) {
                    throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                            "Plaza Scope Violation: Plaza Admin can only manage users within their assigned plaza.");
                }
            }
            return;
        }

        if ("Plaza POS".equalsIgnoreCase(actorRole) || "Request Tag Details".equalsIgnoreCase(actorRole) || "Bank".equalsIgnoreCase(actorRole)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Hierarchy Violation: Terminal operational and bank roles cannot create, manage, or approve user accounts.");
        }
    }

    private boolean hasApprovePermission(User actor) {
        if (actor == null) return false;
        String role = actor.getRole();
        if ("Master Admin".equalsIgnoreCase(role)
                || "Admin".equalsIgnoreCase(role)
                || "Concessionaire".equalsIgnoreCase(role)
                || "Plaza Admin".equalsIgnoreCase(role)) {
            return true;
        }
        if (actor.getMenuAccessJson() != null && !actor.getMenuAccessJson().isBlank()) {
            try {
                List<String> perms = objectMapper.readValue(actor.getMenuAccessJson(), new TypeReference<List<String>>() {});
                return perms.contains("user_management_approve_user");
            } catch (Exception ignored) {}
        }
        return false;
    }

    private List<String> getUserPlazas(User user) {
        if (user == null) return List.of();
        if (user.getPlazasJson() != null && !user.getPlazasJson().isBlank()) {
            try {
                return objectMapper.readValue(user.getPlazasJson(), new TypeReference<List<String>>() {});
            } catch (Exception ignored) {}
        }
        if (user.getAssignedPlaza() != null && !user.getAssignedPlaza().isBlank()) {
            return Arrays.stream(user.getAssignedPlaza().split(","))
                    .map(String::trim)
                    .filter(s -> !s.isBlank())
                    .collect(Collectors.toList());
        }
        return List.of();
    }

    private boolean hasPlazaOverlap(User actor, User targetUser, String targetPlaza) {
        if (actor == null) return false;
        List<String> actorPlazas = getUserPlazas(actor);
        if (actorPlazas.isEmpty()) {
            return true;
        }
        if (actorPlazas.stream().anyMatch(p -> "All plazas".equalsIgnoreCase(p))) {
            return true;
        }

        // If targetPlaza is specified (creation or update), verify all target plazas belong to actor scope
        if (targetPlaza != null && !targetPlaza.isBlank()) {
            List<String> requestedPlazas = Arrays.stream(targetPlaza.split(","))
                    .map(String::trim)
                    .filter(s -> !s.isBlank())
                    .collect(Collectors.toList());
            boolean allInScope = requestedPlazas.stream().allMatch(rp ->
                    actorPlazas.stream().anyMatch(ap ->
                            ap.equalsIgnoreCase(rp) || ap.toLowerCase().contains(rp.toLowerCase()) || rp.toLowerCase().contains(ap.toLowerCase())
                    )
            );
            if (!allInScope) {
                return false;
            }
        }

        // If checking an existing user (e.g. approve/manage), verify existing user plazas also overlap with actor scope
        if (targetUser != null) {
            List<String> existingPlazas = getUserPlazas(targetUser);
            if (!existingPlazas.isEmpty()) {
                boolean existingInScope = existingPlazas.stream().anyMatch(ep ->
                        actorPlazas.stream().anyMatch(ap ->
                                ap.equalsIgnoreCase(ep) || ap.toLowerCase().contains(ep.toLowerCase()) || ep.toLowerCase().contains(ap.toLowerCase())
                        )
                );
                if (!existingInScope) {
                    return false;
                }
            }
        }

        return true;
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
        List<String> realDbPlazas = plazaRepository.findAll().stream()
                .map(Plaza::getName)
                .filter(n -> n != null && !n.isBlank())
                .collect(Collectors.toList());
        if (realDbPlazas.isEmpty()) {
            realDbPlazas = ALL_AVAILABLE_PLAZAS;
        }

        if ("Master Admin".equalsIgnoreCase(role) || "Admin".equalsIgnoreCase(role)) {
            user.setAssignedPlaza("All plazas");
            try {
                user.setPlazasJson(objectMapper.writeValueAsString(realDbPlazas));
            } catch (Exception ignored) {}
        } else if ("Bank".equalsIgnoreCase(role)) {
            user.setAssignedPlaza("None (Bank Scope)");
            user.setPlazasJson("[]");
        } else if ("Concessionaire".equalsIgnoreCase(role)) {
            List<String> raw = new ArrayList<>();
            if (plazaList != null && !plazaList.isEmpty()) {
                raw.addAll(plazaList);
            } else if (singlePlaza != null && !singlePlaza.isBlank()) {
                raw.add(singlePlaza);
            } else {
                raw.add(realDbPlazas.get(0));
            }
            List<String> flattened = raw.stream()
                    .flatMap(p -> Arrays.stream(p.split(",")))
                    .map(String::trim)
                    .filter(s -> !s.isBlank())
                    .distinct()
                    .collect(Collectors.toList());
            user.setAssignedPlaza(String.join(", ", flattened));
            try {
                user.setPlazasJson(objectMapper.writeValueAsString(flattened));
            } catch (Exception ignored) {}
        } else {
            // Toll Plaza, EV, Parking, Fuel, Other: Single plaza
            String plaza = (singlePlaza != null && !singlePlaza.isBlank()) ? singlePlaza : realDbPlazas.get(0);
            user.setAssignedPlaza(plaza);
            user.setPlazasJson("[\"" + plaza + "\"]");
        }
    }

    /**
     * Checks if a user has not logged in for 72+ hours.
     * If so, automatically sets their status to locked (dormant).
     */
    public boolean checkAndApplyDormancy(User user) {
        if (user == null || "Master Admin".equalsIgnoreCase(user.getRole()) ||
                "Trash User".equalsIgnoreCase(user.getStatus()) || "Trash".equalsIgnoreCase(user.getStatus())) {
            return false;
        }
        LocalDateTime refTime = user.getLastActive();
        if (refTime != null && refTime.isBefore(LocalDateTime.now().minusHours(72))) {
            if (!user.isLocked()) {
                user.setLocked(true);
                user.setUpdatedAt(LocalDateTime.now());
                try {
                    userRepository.save(user);
                } catch (Exception ignored) {}
            }
            return true;
        }
        return false;
    }

    /**
     * Records a login / activity touch to renew lastActive timestamp
     */
    @Transactional
    public void recordLogin(String id) {
        userRepository.findById(id).ifPresent(user -> {
            user.setLastActive(LocalDateTime.now());
            user.setUpdatedAt(LocalDateTime.now());
            userRepository.save(user);
        });
    }

    /**
     * Secure self or administrative password change
     */
    @Auditable(module = "User Management", action = "CHANGE_PASSWORD", actionLabel = "Changed User Password")
    @Transactional
    public void changePassword(String id, String currentPassword, String newPassword, String actorId) {
        User user = userRepository.findById(id)
                .or(() -> userRepository.findByEmailIgnoreCase(id))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        if (newPassword == null || newPassword.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "New password is required.");
        }

        // Verify current password if provided
        if (currentPassword != null && !currentPassword.isBlank()) {
            String existing = user.getPassword() != null && !user.getPassword().isBlank() ? user.getPassword() : "Paysonic@2026";
            if (!existing.equals(currentPassword.trim())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Current password does not match.");
            }
        }

        user.setPassword(newPassword.trim());
        user.setUpdatedAt(LocalDateTime.now());
        userRepository.save(user);
    }
}
