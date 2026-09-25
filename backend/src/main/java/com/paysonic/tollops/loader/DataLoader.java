package com.paysonic.tollops.loader;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.paysonic.tollops.entity.*;
import com.paysonic.tollops.repository.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.io.InputStream;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Component
public class DataLoader implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DataLoader.class);

    private final UserRepository userRepository;
    private final UserSessionRepository userSessionRepository;
    private final LoginHistoryRepository loginHistoryRepository;
    private final AuditLogRepository auditLogRepository;
    private final ConcessionaireRepository concessionaireRepository;
    private final PlazaRepository plazaRepository;
    private final LaneRepository laneRepository;
    private final PlazaCallbackRepository plazaCallbackRepository;
    private final PlazaFareRepository plazaFareRepository;
    private final PlazaCchRepository plazaCchRepository;
    private final ObjectMapper objectMapper;

    public DataLoader(UserRepository userRepository,
                      UserSessionRepository userSessionRepository,
                      LoginHistoryRepository loginHistoryRepository,
                      AuditLogRepository auditLogRepository,
                      ConcessionaireRepository concessionaireRepository,
                      PlazaRepository plazaRepository,
                      LaneRepository laneRepository,
                      PlazaCallbackRepository plazaCallbackRepository,
                      PlazaFareRepository plazaFareRepository,
                      PlazaCchRepository plazaCchRepository,
                      ObjectMapper objectMapper) {
        this.userRepository = userRepository;
        this.userSessionRepository = userSessionRepository;
        this.loginHistoryRepository = loginHistoryRepository;
        this.auditLogRepository = auditLogRepository;
        this.concessionaireRepository = concessionaireRepository;
        this.plazaRepository = plazaRepository;
        this.laneRepository = laneRepository;
        this.plazaCallbackRepository = plazaCallbackRepository;
        this.plazaFareRepository = plazaFareRepository;
        this.plazaCchRepository = plazaCchRepository;
        this.objectMapper = objectMapper;
    }

    @Override
    public void run(String... args) {
        try {
            seedUsers();
            seedUserSessions();
            seedLoginHistory();
            seedAuditLogs();
            seedOnboardingData();
            log.info("Paysonic Toll Ops Initial Database Seed Completed Successfully.");
        } catch (Exception e) {
            log.error("Error seeding initial Toll Ops data into database", e);
        }
    }

    private void seedUsers() {
        if (userRepository.count() > 0) {
            List<User> existing = userRepository.findAll();
            boolean changed = false;
            for (User u : existing) {
                if (u.getPassword() == null || u.getPassword().isBlank()) {
                    u.setPassword("Paysonic@2026");
                    changed = true;
                }
            }
            if (changed) {
                userRepository.saveAll(existing);
                log.info("Backfilled default passwords for existing users.");
            }
            return;
        }

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
                        u.setPassword(n.has("password") ? n.get("password").asText() : "Paysonic@2026");
                        u.setAvatar(n.has("avatar") ? n.get("avatar").asText() : null);
                        u.setCreatedBy("SYSTEM");
                        u.setApprovedBy("Sanjay Kulkarni");
                        u.setCreatedAt(LocalDateTime.now());
                        u.setUpdatedAt(LocalDateTime.now());
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
                        s.setSessionId(n.has("id") ? n.get("id").asText() : UUID.randomUUID().toString());
                        s.setUserId(n.has("userId") ? n.get("userId").asText() : "PSN0005");
                        s.setName(n.has("name") ? n.get("name").asText() : "Unknown");
                        s.setRole(n.has("role") ? n.get("role").asText() : "Admin");
                        s.setPlaza(n.has("plaza") ? n.get("plaza").asText() : "All plazas");
                        s.setIpAddress(n.has("ipAddress") ? n.get("ipAddress").asText() : "127.0.0.1");
                        s.setDevice(n.has("device") ? n.get("device").asText() : "Chrome / Windows");
                        s.setStatus(n.has("status") ? n.get("status").asText() : "Active");
                        s.setLoginTime(LocalDateTime.now().minusHours(1));
                        s.setLastActive(LocalDateTime.now());
                        list.add(s);
                    }
                    userSessionRepository.saveAll(list);
                    log.info("Seeded {} user sessions into database", list.size());
                }
            }
        } catch (Exception e) {
            log.error("Failed to seed user sessions", e);
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
                        lh.setUserId(n.has("userId") ? n.get("userId").asText() : "PSN0005");
                        lh.setName(n.has("name") ? n.get("name").asText() : "Unknown");
                        lh.setRole(n.has("role") ? n.get("role").asText() : "Admin");
                        lh.setIpAddress(n.has("ipAddress") ? n.get("ipAddress").asText() : "127.0.0.1");
                        lh.setDevice(n.has("device") ? n.get("device").asText() : "Chrome / Windows");
                        lh.setStatus(n.has("status") ? n.get("status").asText() : "Success");
                        lh.setFailureReason(n.has("failureReason") ? n.get("failureReason").asText() : null);
                        lh.setTimestamp(LocalDateTime.now().minusHours((long) (Math.random() * 72)));
                        list.add(lh);
                    }
                    loginHistoryRepository.saveAll(list);
                    log.info("Seeded {} login history records into database", list.size());
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

    // ─── Real Database Seeding for Plaza Onboarding ─────────────────────────────

    private void seedOnboardingData() {
        if (plazaRepository.count() > 0) {
            log.info("Plazas already exist in database (count: {}), skipping seed.", plazaRepository.count());
            return;
        }

        try {
            log.info("Seeding real production Onboarding data into database...");

            // 1. Concessionaires
            List<Concessionaire> concessionaires = List.of(
                new Concessionaire("CON-1001", "GMR HIGHWAYS", "Plot 12, DLF Cyber City, Gurugram, Haryana", "ops@gmrhighways.com", "9811022330"),
                new Concessionaire("CON-1002", "IRB INFRA", "IRB Complex, Mumbai-Pune Expressway, Pune, Maharashtra", "ops@irbinfra.com", "9822011445"),
                new Concessionaire("CON-1003", "L&T INFRASTRUCTURE CONCESSIONS", "L&T House, Ballard Estate, Mumbai, Maharashtra", "tollops@ltidpl.com", "9820033221")
            );
            concessionaireRepository.saveAll(concessionaires);
            log.info("Seeded {} real Concessionaires into database", concessionaires.size());

            // 2. Real Plazas
            List<Plaza> plazas = new ArrayList<>();

            Plaza p1 = new Plaza();
            p1.setId("203451");
            p1.setName("KHERKI DAULA");
            p1.setOrgId("PYSN");
            p1.setAgencyId("NHAI1");
            p1.setConcessionaireId("CON-1001");
            p1.setCategory("Toll");
            p1.setBasePricing("Distance Based");
            p1.setPlazaInterface("API");
            p1.setSubtype("National");
            p1.setAuthority("NHAI");
            p1.setState("HARYANA");
            p1.setCity("GURUGRAM");
            p1.setActivationDate("2026-09-17");
            p1.setGeoCode("28.4089,76.9647");
            p1.setSchemeRule("Single Return");
            p1.setSchemeDuration("24 Hrs");
            p1.setStatus("Active");
            p1.setContactAddress("NH-48, Kherki Daula Toll Plaza, Gurugram, Haryana");
            p1.setContactNo("9811022330");
            p1.setContactMail("kherki.daula@gmrhighways.com");
            p1.setMdrJson("{\"bankFee\":\"0.90\",\"npciFee\":\"0.15\",\"bankGst\":\"18\",\"npciGst\":\"18\"}");
            plazas.add(p1);

            Plaza p2 = new Plaza();
            p2.setId("220450");
            p2.setName("MANESAR");
            p2.setOrgId("PYSN");
            p2.setAgencyId("NHAI1");
            p2.setConcessionaireId("CON-1001");
            p2.setCategory("Toll");
            p2.setBasePricing("Distance Based");
            p2.setPlazaInterface("API");
            p2.setSubtype("National");
            p2.setAuthority("NHAI");
            p2.setState("HARYANA");
            p2.setCity("GURUGRAM");
            p2.setActivationDate("2026-09-15");
            p2.setGeoCode("28.3540,76.9350");
            p2.setSchemeRule("Single Return");
            p2.setSchemeDuration("24 Hrs");
            p2.setStatus("Active");
            p2.setContactAddress("Sector 8, IMT Manesar, Gurugram");
            p2.setContactNo("9811022331");
            p2.setContactMail("manesar.ops@gmrhighways.com");
            p2.setMdrJson("{\"bankFee\":\"0.90\",\"npciFee\":\"0.15\",\"bankGst\":\"18\",\"npciGst\":\"18\"}");
            plazas.add(p2);

            Plaza p3 = new Plaza();
            p3.setId("238800");
            p3.setName("JAIPUR BYPASS");
            p3.setOrgId("PYSN");
            p3.setAgencyId("NHAI2");
            p3.setConcessionaireId("CON-1001");
            p3.setCategory("Toll");
            p3.setBasePricing("Point Based");
            p3.setPlazaInterface("API");
            p3.setSubtype("State");
            p3.setAuthority("NHAI");
            p3.setState("RAJASTHAN");
            p3.setCity("JAIPUR");
            p3.setActivationDate("2026-09-03");
            p3.setGeoCode("26.9124,75.7873");
            p3.setSchemeRule("Single Single");
            p3.setSchemeDuration("Same Day Midnight");
            p3.setStatus("Active");
            p3.setContactAddress("Jaipur Bypass Toll Plaza, NH-52");
            p3.setContactNo("9829011223");
            p3.setContactMail("jaipur.bypass@gmrhighways.com");
            p3.setMdrJson("{\"bankFee\":\"0.85\",\"npciFee\":\"0.15\",\"bankGst\":\"18\",\"npciGst\":\"18\"}");
            plazas.add(p3);

            Plaza p4 = new Plaza();
            p4.setId("305500");
            p4.setName("KISHANGARH");
            p4.setOrgId("PYSN");
            p4.setAgencyId("IHM1");
            p4.setConcessionaireId("CON-1002");
            p4.setCategory("Toll");
            p4.setBasePricing("Distance Based");
            p4.setPlazaInterface("SFTP");
            p4.setSubtype("National");
            p4.setAuthority("IHMCL");
            p4.setState("RAJASTHAN");
            p4.setCity("KISHANGARH");
            p4.setActivationDate("2026-08-11");
            p4.setGeoCode("26.5833,74.8667");
            p4.setSchemeRule("3rd Journey DP");
            p4.setSchemeDuration("24 Hrs");
            p4.setStatus("Pending Approval");
            p4.setContactAddress("NH-48, Kishangarh Expressway, Ajmer");
            p4.setContactNo("9822011446");
            p4.setContactMail("kishangarh@irbinfra.com");
            p4.setMdrJson("{\"bankFee\":\"0.90\",\"npciFee\":\"0.15\",\"bankGst\":\"18\",\"npciGst\":\"18\"}");
            plazas.add(p4);

            Plaza p5 = new Plaza();
            p5.setId("418800");
            p5.setName("SHAHJAHANPUR");
            p5.setOrgId("PYSN");
            p5.setAgencyId("NHAI3");
            p5.setConcessionaireId("CON-1002");
            p5.setCategory("Toll");
            p5.setBasePricing("Custom Based");
            p5.setPlazaInterface("API");
            p5.setSubtype("National");
            p5.setAuthority("NHAI");
            p5.setState("RAJASTHAN");
            p5.setCity("SHAHJAHANPUR");
            p5.setActivationDate("2026-09-22");
            p5.setGeoCode("27.8829,79.9110");
            p5.setSchemeRule("Single Return");
            p5.setSchemeDuration("24 Hrs");
            p5.setStatus("Draft");
            p5.setContactAddress("NH-48, Shahjahanpur Border Toll Plaza");
            p5.setContactNo("9822011447");
            p5.setContactMail("shahjahanpur@irbinfra.com");
            p5.setMdrJson("{\"bankFee\":\"0.90\",\"npciFee\":\"0.15\",\"bankGst\":\"18\",\"npciGst\":\"18\"}");
            plazas.add(p5);

            plazaRepository.saveAll(plazas);
            log.info("Seeded {} real Plazas into database", plazas.size());

            // 3. Seed Lanes (6 lanes for each plaza = 30 real lanes)
            String[] dirs = {"North", "South"};
            String[] types = {"Entry", "Exit"};
            String[] cats = {"Hybrid", "Dedicated", "Handheld"};
            List<Lane> lanes = new ArrayList<>();

            for (Plaza p : plazas) {
                for (int i = 1; i <= 6; i++) {
                    String laneId = String.format("L%s%02d", p.getId().substring(Math.max(0, p.getId().length() - 3)), i);
                    Lane lane = new Lane(
                        p.getId(),
                        laneId,
                        dirs[i % 2],
                        types[i % 2],
                        i == 6 ? "Maintenance" : "Normal",
                        cats[i % 3],
                        "Open"
                    );
                    lanes.add(lane);
                }
            }
            laneRepository.saveAll(lanes);
            log.info("Seeded {} real Lanes into database", lanes.size());

            // 4. Seed Callback URLs, Fares, and CCH for each plaza
            String[] callbackApis = {
                "HeartBeatAPI", "PlazaStatusAPI", "LaneStatusAPI", "TagValidationAPI",
                "TransactionStatusAPI", "FareCalculationAPI", "QueryExceptionListAPI",
                "PaymentNotificationAPI", "DisputeStatusAPI", "ReconFeedAPI",
                "MdrSettlementAPI", "PassValidationAPI", "HardwareAlertAPI", "AuditExportAPI"
            };

            String[] vehicleClasses = {
                "VC4", "VC5", "VC6", "VC7", "VC8", "VC9", "VC10",
                "VC11", "VC12", "VC13", "VC14", "VC15", "VC16", "VC17", "VC18", "VC19", "VC20"
            };

            for (Plaza p : plazas) {
                // Callbacks
                Map<String, String> cbMap = new LinkedHashMap<>();
                for (String api : callbackApis) {
                    cbMap.put(api, String.format("https://api.paysonic.in/%s/%s", p.getId().toLowerCase(), api.toLowerCase()));
                }
                plazaCallbackRepository.save(new PlazaCallback(p.getId(), objectMapper.writeValueAsString(cbMap)));

                // Toll Fare Matrix
                Map<String, Map<String, Object>> fareMap = new LinkedHashMap<>();
                for (int i = 0; i < vehicleClasses.length; i++) {
                    int base = 50 + i * 25;
                    Map<String, Object> rates = new LinkedHashMap<>();
                    rates.put("single", base);
                    rates.put("ret", Math.round(base * 1.5));
                    rates.put("local10", Math.round(base * 0.4));
                    rates.put("local20", Math.round(base * 0.6));
                    rates.put("district", Math.round(base * 20));
                    rates.put("monthly", Math.round(base * 40));
                    fareMap.put(vehicleClasses[i], rates);
                }
                plazaFareRepository.save(new PlazaFare(p.getId(), objectMapper.writeValueAsString(fareMap)));

                // CCH Mapping
                Map<String, Map<String, Object>> cchMap = new LinkedHashMap<>();
                for (int i = 0; i < vehicleClasses.length; i++) {
                    Map<String, Object> item = new LinkedHashMap<>();
                    item.put("current", 100 + i * 5);
                    item.put("new", "");
                    cchMap.put(vehicleClasses[i], item);
                }
                plazaCchRepository.save(new PlazaCch(p.getId(), objectMapper.writeValueAsString(cchMap)));
            }

            log.info("Successfully populated all Callback URLs, Fare Matrices, and CCH Mappings into real database.");

        } catch (Exception e) {
            log.error("Failed to seed onboarding data into real database", e);
        }
    }
}
