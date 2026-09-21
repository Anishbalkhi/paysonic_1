package com.paysonic.tollops.loader;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.paysonic.tollops.entity.AuditLog;
import com.paysonic.tollops.entity.LoginHistory;
import com.paysonic.tollops.entity.User;
import com.paysonic.tollops.entity.UserSession;
import com.paysonic.tollops.repository.AuditLogRepository;
import com.paysonic.tollops.repository.LoginHistoryRepository;
import com.paysonic.tollops.repository.UserRepository;
import com.paysonic.tollops.repository.UserSessionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.io.InputStream;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

@Component
public class DataLoader implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DataLoader.class);

    private final UserRepository userRepository;
    private final UserSessionRepository userSessionRepository;
    private final LoginHistoryRepository loginHistoryRepository;
    private final AuditLogRepository auditLogRepository;
    private final ObjectMapper objectMapper;

    public DataLoader(UserRepository userRepository,
                      UserSessionRepository userSessionRepository,
                      LoginHistoryRepository loginHistoryRepository,
                      AuditLogRepository auditLogRepository,
                      ObjectMapper objectMapper) {
        this.userRepository = userRepository;
        this.userSessionRepository = userSessionRepository;
        this.loginHistoryRepository = loginHistoryRepository;
        this.auditLogRepository = auditLogRepository;
        this.objectMapper = objectMapper;
    }

    @Override
    public void run(String... args) {
        try {
            seedUsers();
            seedUserSessions();
            seedLoginHistory();
            seedAuditLogs();
            log.info("Paysonic Toll Ops Initial Database Seed Completed Successfully.");
        } catch (Exception e) {
            log.error("Error seeding initial Toll Ops data into database", e);
        }
    }

    private void seedUsers() {
        if (userRepository.count() > 0) return;

        try {
            ClassPathResource res = new ClassPathResource("data/userList.json");
            if (res.exists()) {
                try (InputStream is = res.getInputStream()) {
                    JsonNode array = objectMapper.readTree(is);
                    List<User> list = new ArrayList<>();
                    for (JsonNode n : array) {
                        User u = new User();
                        u.setId(n.has("id") ? n.get("id").asText() : "PSN" + System.currentTimeMillis());
                        u.setName(n.has("name") ? n.get("name").asText() : "Unknown");
                        u.setEmail(n.has("email") ? n.get("email").asText() : u.getId() + "@paysonic.com");
                        u.setMobile(n.has("mobile") ? n.get("mobile").asText() : "+91 9876543210");
                        u.setRole(n.has("role") ? n.get("role").asText() : "Admin");
                        u.setUserType(n.has("userType") ? n.get("userType").asText() : "Toll Plaza");
                        u.setAssignedPlaza(n.has("assignedPlaza") ? n.get("assignedPlaza").asText() : "All plazas");
                        u.setStatus(n.has("status") ? n.get("status").asText() : "Active");
                        u.setApproval(n.has("approval") ? n.get("approval").asText() : "Approved");
                        u.setLocked(n.has("locked") && n.get("locked").asBoolean());
                        u.setAvatar(n.has("avatar") ? n.get("avatar").asText() : null);
                        u.setCreatedBy("SYSTEM");
                        u.setApprovedBy("Sanjay Kulkarni");
                        u.setCreatedAt(LocalDateTime.now());
                        u.setUpdatedAt(LocalDateTime.now());

                        if (n.has("plazas") && n.get("plazas").isArray()) {
                            u.setPlazasJson(objectMapper.writeValueAsString(n.get("plazas")));
                        }

                        list.add(u);
                    }
                    userRepository.saveAll(list);
                    log.info("Seeded {} users into database", list.size());
                }
            }
        } catch (Exception e) {
            log.error("Failed to seed users", e);
        }
    }

    private void seedUserSessions() {
        if (userSessionRepository.count() > 0) return;

        try {
            ClassPathResource res = new ClassPathResource("data/activeUsers.json");
            if (res.exists()) {
                try (InputStream is = res.getInputStream()) {
                    JsonNode array = objectMapper.readTree(is);
                    List<UserSession> list = new ArrayList<>();
                    for (JsonNode n : array) {
                        UserSession s = new UserSession();
                        s.setSessionId(n.has("sessionId") ? n.get("sessionId").asText() : "sess_" + System.currentTimeMillis());
                        s.setUserId(n.has("userId") ? n.get("userId").asText() : "PSN0001");
                        s.setName(n.has("name") ? n.get("name").asText() : "User");
                        s.setRole(n.has("role") ? n.get("role").asText() : "Operator");
                        s.setPlaza(n.has("plaza") ? n.get("plaza").asText() : "All plazas");
                        s.setIpAddress(n.has("ipAddress") ? n.get("ipAddress").asText() : "103.21.58.12");
                        s.setDevice(n.has("device") ? n.get("device").asText() : "Chrome / Windows 11");
                        s.setStatus("Active");
                        s.setLoginTime(LocalDateTime.now().minusHours(2));
                        s.setLastActive(LocalDateTime.now().minusMinutes(5));
                        list.add(s);
                    }
                    userSessionRepository.saveAll(list);
                    log.info("Seeded {} active sessions into database", list.size());
                }
            }
        } catch (Exception e) {
            log.error("Failed to seed active sessions", e);
        }
    }

    private void seedLoginHistory() {
        if (loginHistoryRepository.count() > 0) return;

        try {
            ClassPathResource res = new ClassPathResource("data/loginHistory.json");
            if (res.exists()) {
                try (InputStream is = res.getInputStream()) {
                    JsonNode array = objectMapper.readTree(is);
                    List<LoginHistory> list = new ArrayList<>();
                    for (JsonNode n : array) {
                        LoginHistory lh = new LoginHistory();
                        lh.setUserId(n.has("userId") ? n.get("userId").asText() : "PSN0001");
                        lh.setName(n.has("name") ? n.get("name").asText() : "User");
                        lh.setRole(n.has("role") ? n.get("role").asText() : "Operator");
                        lh.setIpAddress(n.has("ipAddress") ? n.get("ipAddress").asText() : "103.21.58.12");
                        lh.setDevice(n.has("device") ? n.get("device").asText() : "Chrome / Windows 11");
                        lh.setStatus(n.has("status") ? n.get("status").asText() : "Success");
                        lh.setFailureReason(n.has("failureReason") ? n.get("failureReason").asText() : null);
                        lh.setTimestamp(LocalDateTime.now().minusHours((long) (Math.random() * 48)));
                        list.add(lh);
                    }
                    loginHistoryRepository.saveAll(list);
                    log.info("Seeded {} login history entries into database", list.size());
                }
            }
        } catch (Exception e) {
            log.error("Failed to seed login history", e);
        }
    }

    private void seedAuditLogs() {
        if (auditLogRepository.count() > 0) return;

        try {
            ClassPathResource res = new ClassPathResource("data/auditLog.json");
            if (res.exists()) {
                try (InputStream is = res.getInputStream()) {
                    JsonNode array = objectMapper.readTree(is);
                    List<AuditLog> list = new ArrayList<>();
                    for (JsonNode n : array) {
                        AuditLog al = new AuditLog();
                        al.setId(n.has("id") ? n.get("id").asText() : "AUD-" + System.currentTimeMillis());
                        al.setModule(n.has("module") ? n.get("module").asText() : "General");
                        al.setAction(n.has("action") ? n.get("action").asText() : "ACTION");
                        al.setActionLabel(n.has("actionLabel") ? n.get("actionLabel").asText() : "Action Executed");
                        al.setStatus(n.has("status") ? n.get("status").asText() : "SUCCESS");
                        al.setPlaza(n.has("plaza") ? n.get("plaza").asText() : "All plazas");
                        al.setTarget(n.has("target") ? n.get("target").asText() : "System");
                        al.setReferenceId(n.has("referenceId") ? n.get("referenceId").asText() : null);
                        al.setCorrelationId(n.has("correlationId") ? n.get("correlationId").asText() : "CORR-" + al.getId());
                        al.setDetails(n.has("details") ? n.get("details").asText() : "Executed action");

                        if (n.has("actor")) {
                            JsonNode act = n.get("actor");
                            al.setActorId(act.has("id") ? act.get("id").asText() : "PSN0005");
                            al.setActorName(act.has("name") ? act.get("name").asText() : "Sanjay Kulkarni");
                            al.setActorRole(act.has("role") ? act.get("role").asText() : "Master Admin");
                            al.setActorIp(act.has("ipAddress") ? act.get("ipAddress").asText() : "103.21.58.44");
                        } else {
                            al.setActorId("PSN0005");
                            al.setActorName("Sanjay Kulkarni");
                            al.setActorRole("Master Admin");
                            al.setActorIp("103.21.58.44");
                        }

                        if (n.has("before") && !n.get("before").isNull()) {
                            al.setBeforeJson(objectMapper.writeValueAsString(n.get("before")));
                        }
                        if (n.has("after") && !n.get("after").isNull()) {
                            al.setAfterJson(objectMapper.writeValueAsString(n.get("after")));
                        }

                        al.setTimestamp(LocalDateTime.now().minusMinutes((long) (Math.random() * 1440)));
                        list.add(al);
                    }
                    auditLogRepository.saveAll(list);
                    log.info("Seeded {} audit log entries into database", list.size());
                }
            }
        } catch (Exception e) {
            log.error("Failed to seed audit logs", e);
        }
    }
}
