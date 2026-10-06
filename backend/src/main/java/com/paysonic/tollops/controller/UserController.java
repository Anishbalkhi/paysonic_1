package com.paysonic.tollops.controller;

import com.paysonic.tollops.dto.CreateUserRequest;
import com.paysonic.tollops.dto.UserResponseDTO;
import com.paysonic.tollops.service.UserService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/users")
@CrossOrigin(origins = "*")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping
    public ResponseEntity<?> getAllUsers(
            @RequestParam(value = "page", required = false) Integer page,
            @RequestParam(value = "size", required = false, defaultValue = "10") int size,
            @RequestParam(value = "search", required = false) String search,
            @RequestParam(value = "role", required = false) String role,
            @RequestParam(value = "status", required = false) String status,
            @RequestParam(value = "plaza", required = false) String plaza) {
        if (page != null) {
            int pageSize = Math.min(Math.max(size, 1), 10); // strictly maximum 10 records per page
            return ResponseEntity.ok(userService.getPagedUsers(page, pageSize, search, role, status, plaza));
        }
        return ResponseEntity.ok(userService.getAllUsers());
    }

    @GetMapping("/{id}")
    public ResponseEntity<UserResponseDTO> getUserById(@PathVariable String id) {
        return ResponseEntity.ok(userService.getUserById(id));
    }

    @PostMapping
    public ResponseEntity<UserResponseDTO> createUser(
            @Valid @RequestBody CreateUserRequest request,
            @RequestHeader(value = "X-Actor-ID", required = false, defaultValue = "PSN1000") String actorId) {
        UserResponseDTO created = userService.createUser(request, actorId);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PutMapping("/{id}")
    public ResponseEntity<UserResponseDTO> updateUser(
            @PathVariable String id,
            @RequestBody CreateUserRequest request,
            @RequestHeader(value = "X-Actor-ID", required = false, defaultValue = "PSN1000") String actorId) {
        return ResponseEntity.ok(userService.updateUser(id, request, actorId));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, Object>> deleteUser(
            @PathVariable String id,
            @RequestHeader(value = "X-Actor-ID", required = false, defaultValue = "PSN1000") String actorId) {
        userService.deleteUser(id, actorId);
        return ResponseEntity.ok(Map.of("success", true, "id", id, "status", "Trash User"));
    }

    @PatchMapping("/{id}/activate")
    public ResponseEntity<UserResponseDTO> activateUser(
            @PathVariable String id,
            @RequestHeader(value = "X-Actor-ID", required = false, defaultValue = "PSN1000") String actorId) {
        return ResponseEntity.ok(userService.activateUser(id, actorId));
    }

    @PatchMapping("/{id}/lock")
    public ResponseEntity<UserResponseDTO> toggleLock(
            @PathVariable String id,
            @RequestHeader(value = "X-Actor-ID", required = false, defaultValue = "PSN1000") String actorId) {
        return ResponseEntity.ok(userService.toggleLock(id, actorId));
    }

    @PatchMapping("/{id}/approve")
    public ResponseEntity<UserResponseDTO> approveUser(
            @PathVariable String id,
            @RequestHeader(value = "X-Actor-ID", required = false) String actorId) {
        if (actorId == null || actorId.isBlank()) {
            throw new org.springframework.web.server.ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "X-Actor-ID header is required for approval action.");
        }
        return ResponseEntity.ok(userService.approveUser(id, actorId));
    }

    @PostMapping("/bulk-upload")
    public ResponseEntity<List<UserResponseDTO>> bulkUpload(
            @RequestParam("file") MultipartFile file,
            @RequestHeader(value = "X-Actor-ID", required = false, defaultValue = "PSN1000") String actorId) {
        return ResponseEntity.ok(userService.bulkUpload(file, actorId));
    }

    @PatchMapping("/{id}/touch-activity")
    public ResponseEntity<Map<String, Object>> touchActivity(@PathVariable String id) {
        userService.recordLogin(id);
        return ResponseEntity.ok(Map.of("success", true, "id", id));
    }

    @PatchMapping("/{id}/change-password")
    public ResponseEntity<Map<String, Object>> changePassword(
            @PathVariable String id,
            @RequestBody Map<String, String> body,
            @RequestHeader(value = "X-Actor-ID", required = false) String actorId) {
        String currentPassword = body.get("currentPassword");
        String newPassword = body.get("newPassword");
        userService.changePassword(id, currentPassword, newPassword, actorId);
        return ResponseEntity.ok(Map.of("success", true, "message", "Password changed successfully"));
    }
}
