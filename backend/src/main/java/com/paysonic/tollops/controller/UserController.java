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
    public ResponseEntity<List<UserResponseDTO>> getAllUsers() {
        return ResponseEntity.ok(userService.getAllUsers());
    }

    @GetMapping("/{id}")
    public ResponseEntity<UserResponseDTO> getUserById(@PathVariable String id) {
        return ResponseEntity.ok(userService.getUserById(id));
    }

    @PostMapping
    public ResponseEntity<UserResponseDTO> createUser(
            @Valid @RequestBody CreateUserRequest request,
            @RequestHeader(value = "X-Actor-ID", required = false, defaultValue = "PSN0005") String actorId) {
        UserResponseDTO created = userService.createUser(request, actorId);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PutMapping("/{id}")
    public ResponseEntity<UserResponseDTO> updateUser(
            @PathVariable String id,
            @RequestBody CreateUserRequest request,
            @RequestHeader(value = "X-Actor-ID", required = false, defaultValue = "PSN0001") String actorId) {
        return ResponseEntity.ok(userService.updateUser(id, request, actorId));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, Object>> deleteUser(
            @PathVariable String id,
            @RequestHeader(value = "X-Actor-ID", required = false, defaultValue = "PSN0001") String actorId) {
        userService.deleteUser(id, actorId);
        return ResponseEntity.ok(Map.of("success", true, "id", id));
    }

    @PatchMapping("/{id}/lock")
    public ResponseEntity<UserResponseDTO> toggleLock(
            @PathVariable String id,
            @RequestHeader(value = "X-Actor-ID", required = false, defaultValue = "PSN0001") String actorId) {
        return ResponseEntity.ok(userService.toggleLock(id, actorId));
    }

    @PatchMapping("/{id}/approve")
    public ResponseEntity<UserResponseDTO> approveUser(
            @PathVariable String id,
            @RequestHeader(value = "X-Actor-ID", required = false, defaultValue = "PSN0005") String actorId) {
        return ResponseEntity.ok(userService.approveUser(id, actorId));
    }

    @PostMapping("/bulk-upload")
    public ResponseEntity<List<UserResponseDTO>> bulkUpload(
            @RequestParam("file") MultipartFile file,
            @RequestHeader(value = "X-Actor-ID", required = false, defaultValue = "PSN0005") String actorId) {
        return ResponseEntity.ok(userService.bulkUpload(file, actorId));
    }
}
