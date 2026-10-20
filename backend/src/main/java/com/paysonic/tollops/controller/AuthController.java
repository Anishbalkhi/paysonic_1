package com.paysonic.tollops.controller;

import com.paysonic.tollops.dto.AuditLogRequestDTO;
import com.paysonic.tollops.dto.LoginRequestDTO;
import com.paysonic.tollops.dto.UserResponseDTO;
import com.paysonic.tollops.entity.LoginHistory;
import com.paysonic.tollops.entity.User;
import com.paysonic.tollops.entity.UserSession;
import com.paysonic.tollops.repository.UserRepository;
import com.paysonic.tollops.security.BruteForceProtectionService;
import com.paysonic.tollops.security.RateLimitingFilter;
import com.paysonic.tollops.service.ActivityService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Enterprise Authentication & Security Controller
 * Provides endpoints for secure login verification, brute-force attack prevention,
 * lockout status telemetry, and account unlocking.
 */
@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "*")
public class AuthController {

    private final UserRepository userRepository;
    private final BruteForceProtectionService bruteForceService;
    private final ActivityService activityService;
    private final com.fasterxml.jackson.databind.ObjectMapper objectMapper;

    public AuthController(UserRepository userRepository,
                          BruteForceProtectionService bruteForceService,
                          ActivityService activityService,
                          com.fasterxml.jackson.databind.ObjectMapper objectMapper) {
        this.userRepository = userRepository;
        this.bruteForceService = bruteForceService;
        this.activityService = activityService;
        this.objectMapper = objectMapper;
    }

    /**
     * Authenticates credentials with brute-force defense, lockout enforcement,
     * and session registration.
     */
    @PostMapping("/login")
    public ResponseEntity<Map<String, Object>> login(
            @RequestBody LoginRequestDTO request,
            HttpServletRequest httpRequest) {

        String clientIp = RateLimitingFilter.extractClientIp(httpRequest);
        String rawEmail = request.getEmail() != null ? request.getEmail().trim() : "";
        String emailLower = rawEmail.toLowerCase();
        String enteredPassword = request.getPassword() != null ? request.getPassword().trim() : "";

        // 1. Mandatory format checks
        if (rawEmail.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "error", "Please enter your registered email address."
            ));
        }

        // Prevent username login (Must be registered email ID)
        if (!rawEmail.contains("@")) {
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "error", "Usernames cannot be used for login. Please enter your registered email address."
            ));
        }

        // 2. Pre-check Brute Force Lockout
        if (bruteForceService.isLockedOut(emailLower, clientIp)) {
            long remainingSec = bruteForceService.getRemainingLockoutSeconds(emailLower, clientIp);
            long remainingMins = (remainingSec + 59) / 60;
            String msg = "Account temporarily locked due to multiple failed login attempts. Please try again in " + remainingMins + " minutes.";

            return ResponseEntity.status(HttpStatus.LOCKED).body(Map.of(
                    "success", false,
                    "locked", true,
                    "remainingSeconds", remainingSec,
                    "error", msg,
                    "message", msg
            ));
        }

        // 3. User Lookup
        Optional<User> userOpt = userRepository.findByEmailIgnoreCase(emailLower);
        if (userOpt.isEmpty()) {
            BruteForceProtectionService.AttemptStatus attempt = bruteForceService.recordFailedAttempt(emailLower, clientIp);

            LoginHistory history = new LoginHistory();
            history.setUserId("UNKNOWN");
            history.setName(rawEmail);
            history.setRole("Unknown");
            history.setDevice("Web Browser");
            history.setStatus("Failed");
            history.setFailureReason("User is not found in database");
            history.setIpAddress(clientIp);
            history.setTimestamp(LocalDateTime.now());
            activityService.recordLoginAttempt(history);

            if (attempt.isLocked()) {
                return ResponseEntity.status(HttpStatus.LOCKED).body(Map.of(
                        "success", false,
                        "locked", true,
                        "remainingSeconds", attempt.getLockoutSeconds(),
                        "error", attempt.getMessage(),
                        "message", attempt.getMessage()
                ));
            }

            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of(
                    "success", false,
                    "error", "User is not found. Please enter your registered email address.",
                    "remainingAttempts", attempt.getRemainingAttempts()
            ));
        }

        User user = userOpt.get();

        // 4. Trash user validation
        boolean isTrash = "Trash User".equalsIgnoreCase(user.getStatus()) ||
                          "Trash".equalsIgnoreCase(user.getStatus()) ||
                          String.valueOf(user.getStatus()).toLowerCase().contains("trash");
        if (isTrash) {
            recordLogin(user, "Failed", "your user is locked contact your admin", clientIp);
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of(
                    "success", false,
                    "locked", true,
                    "error", "your user is locked contact your admin"
            ));
        }

        // 5. Account locked validation
        if (user.isLocked()) {
            recordLogin(user, "Failed", "Account locked: profile suspended by administrator", clientIp);
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of(
                    "success", false,
                    "locked", true,
                    "error", "Account locked: Your profile has been suspended. Please contact your system administrator."
            ));
        }

        // 6. Approval & Active status validation
        if (!"Approved".equalsIgnoreCase(user.getApproval()) || "Pending".equalsIgnoreCase(user.getStatus())) {
            recordLogin(user, "Failed", "Account pending: awaiting administrative approval", clientIp);
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of(
                    "success", false,
                    "error", "Account pending: Your onboarding is awaiting administrative approval."
            ));
        }

        if ("Inactive".equalsIgnoreCase(user.getStatus())) {
            recordLogin(user, "Failed", "Account inactive: profile disabled", clientIp);
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of(
                    "success", false,
                    "error", "Account inactive: Your profile is currently disabled."
            ));
        }

        // 7. Password verification
        String expectedPassword = (user.getPassword() != null && !user.getPassword().isBlank())
                ? user.getPassword().trim()
                : "Paysonic@2026";

        if (enteredPassword.isEmpty() || !enteredPassword.equals(expectedPassword)) {
            BruteForceProtectionService.AttemptStatus attempt = bruteForceService.recordFailedAttempt(emailLower, clientIp);
            recordLogin(user, "Failed", "Invalid password: authentication credential mismatch", clientIp);

            // If threshold reached (5 failed attempts), automatically lock user in MySQL DB
            if (attempt.isLocked()) {
                user.setLocked(true);
                userRepository.save(user);

                AuditLogRequestDTO audit = new AuditLogRequestDTO();
                audit.setModule("Security");
                audit.setAction("BRUTE_FORCE_LOCKOUT");
                audit.setActionLabel("Account Locked (Brute-Force Protection)");
                audit.setStatus("FAILURE");
                audit.setActorId(user.getId());
                audit.setActorName(user.getName());
                audit.setActorRole(user.getRole());
                audit.setActorIp(clientIp);
                audit.setTarget(user.getEmail());
                audit.setDetails("Account automatically locked after 5 consecutive failed login attempts from IP: " + clientIp);
                activityService.recordAuditEvent(audit);

                return ResponseEntity.status(HttpStatus.LOCKED).body(Map.of(
                        "success", false,
                        "locked", true,
                        "remainingSeconds", attempt.getLockoutSeconds(),
                        "error", attempt.getMessage(),
                        "message", attempt.getMessage()
                ));
            }

            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of(
                    "success", false,
                    "error", "Invalid password. Please check your credentials and try again.",
                    "remainingAttempts", attempt.getRemainingAttempts()
            ));
        }

        // 8. Successful Login
        bruteForceService.recordSuccess(emailLower, clientIp);
        user.setLastActive(LocalDateTime.now());
        userRepository.save(user);

        recordLogin(user, "Success", null, clientIp);

        // Register Session
        String deviceId = request.getDeviceId() != null && !request.getDeviceId().isBlank()
                ? request.getDeviceId()
                : "DEV-" + UUID.randomUUID().toString().substring(0, 8);

        UserSession session = new UserSession();
        session.setSessionId("SES-" + System.currentTimeMillis());
        session.setUserId(user.getId());
        session.setName(user.getName());
        session.setRole(user.getRole());
        session.setPlaza(user.getAssignedPlaza() != null ? user.getAssignedPlaza() : "All plazas");
        session.setDevice("Web Browser");
        session.setDeviceId(deviceId);
        session.setIpAddress(clientIp);
        UserSession registeredSession = activityService.registerSession(session);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("user", UserResponseDTO.fromEntity(user, objectMapper));
        response.put("sessionId", registeredSession.getSessionId());
        response.put("deviceId", deviceId);
        response.put("token", "paysonic-session-token-" + UUID.randomUUID());

        return ResponseEntity.ok(response);
    }

    /**
     * Returns current lockout status and remaining cooldown seconds.
     */
    @GetMapping("/lockout-status")
    public ResponseEntity<Map<String, Object>> getLockoutStatus(
            @RequestParam(value = "identifier", required = false) String identifier,
            HttpServletRequest httpRequest) {

        String clientIp = RateLimitingFilter.extractClientIp(httpRequest);
        String idKey = (identifier != null) ? identifier.trim().toLowerCase() : "";

        boolean isLocked = bruteForceService.isLockedOut(idKey, clientIp);
        long remainingSec = bruteForceService.getRemainingLockoutSeconds(idKey, clientIp);
        int remainingAttempts = bruteForceService.getRemainingAttempts(idKey, clientIp);

        return ResponseEntity.ok(Map.of(
                "locked", isLocked,
                "remainingSeconds", remainingSec,
                "remainingAttempts", remainingAttempts,
                "maxAttempts", BruteForceProtectionService.MAX_FAILED_ATTEMPTS,
                "clientIp", clientIp
        ));
    }

    /**
     * Administrative endpoint to unlock an account or IP locked by brute-force protection.
     */
    @PostMapping("/unlock")
    public ResponseEntity<Map<String, Object>> unlockAccount(
            @RequestBody Map<String, String> body,
            @RequestHeader(value = "X-Actor-ID", required = false, defaultValue = "PSN0001") String actorId,
            HttpServletRequest httpRequest) {

        String identifier = body.get("identifier");
        String ip = body.get("ip");
        String clientIp = RateLimitingFilter.extractClientIp(httpRequest);

        if (identifier != null && !identifier.isBlank()) {
            bruteForceService.unlock(identifier);
            userRepository.findByEmailIgnoreCase(identifier.trim().toLowerCase()).ifPresent(user -> {
                user.setLocked(false);
                user.setLastActive(LocalDateTime.now());
                userRepository.save(user);
            });
        }

        if (ip != null && !ip.isBlank()) {
            bruteForceService.unlockIp(ip);
        }

        AuditLogRequestDTO audit = new AuditLogRequestDTO();
        audit.setModule("Security");
        audit.setAction("SECURITY_UNLOCK");
        audit.setActionLabel("Security Lockout Cleared");
        audit.setStatus("SUCCESS");
        audit.setActorId(actorId);
        audit.setActorName("Administrator");
        audit.setActorRole("Master Admin");
        audit.setActorIp(clientIp);
        audit.setTarget(identifier != null ? identifier : (ip != null ? ip : "Unknown"));
        audit.setDetails("Security lockout manually cleared by administrator " + actorId);
        activityService.recordAuditEvent(audit);

        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Lockout cleared successfully",
                "identifier", identifier != null ? identifier : "",
                "ip", ip != null ? ip : ""
        ));
    }

    private void recordLogin(User user, String status, String failureReason, String clientIp) {
        LoginHistory history = new LoginHistory();
        history.setUserId(user.getId());
        history.setName(user.getName());
        history.setRole(user.getRole());
        history.setDevice("Web Browser");
        history.setStatus(status);
        history.setFailureReason(failureReason);
        history.setIpAddress(clientIp);
        history.setTimestamp(LocalDateTime.now());
        activityService.recordLoginAttempt(history);
    }
}
