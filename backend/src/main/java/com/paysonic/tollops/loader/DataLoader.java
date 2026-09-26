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
            log.info("Seeding real operational highway network data for Plaza Onboarding...");

            // 1. Concessionaires
            List<Concessionaire> concessionaires = List.of(
                new Concessionaire("CON-1001", "MAHARASHTRA STATE ROAD DEVELOPMENT CORP (MSRDC)", "Bandra Worli Sea Link Project Office, Mumbai, Maharashtra", "ops@msrdc.in", "02226558174"),
                new Concessionaire("CON-1002", "NATIONAL HIGHWAYS INFRA TRUST (NHIT)", "G-5 & 6, Sector-10, Dwarka, New Delhi", "tollops@nhit.co.in", "01125074100"),
                new Concessionaire("CON-1003", "IRB INFRASTRUCTURE DEVELOPERS LTD", "IRB Complex, Chandivali Farm, Andheri East, Mumbai, Maharashtra", "operations@irb.co.in", "02266404220")
            );
            concessionaireRepository.saveAll(concessionaires);
            log.info("Seeded {} real Concessionaires into database", concessionaires.size());

            // 2. Real Plazas
            List<Plaza> plazas = new ArrayList<>();

            Plaza p1 = new Plaza();
            p1.setId("501101");
            p1.setName("MUMBAI PLAZA NH-04");
            p1.setOrgId("PYSN");
            p1.setAgencyId("NHAI1");
            p1.setConcessionaireId("CON-1001");
            p1.setCategory("Toll");
            p1.setBasePricing("Distance Based");
            p1.setPlazaInterface("API");
            p1.setSubtype("National");
            p1.setAuthority("NHAI");
            p1.setState("MAHARASHTRA");
            p1.setCity("MUMBAI");
            p1.setActivationDate("2026-09-01");
            p1.setGeoCode("19.1726,72.9565");
            p1.setSchemeRule("Single Return");
            p1.setSchemeDuration("24 Hrs");
            p1.setStatus("Active");
            p1.setContactAddress("Eastern Express Highway, Mulund Check Naka, Mumbai, Maharashtra");
            p1.setContactNo("02228492011");
            p1.setContactMail("mumbai.toll@nhai.gov.in");
            p1.setMdrJson("{\"bankFee\":\"0.85\",\"npciFee\":\"0.15\",\"bankGst\":\"18\",\"npciGst\":\"18\"}");
            plazas.add(p1);

            Plaza p2 = new Plaza();
            p2.setId("502202");
            p2.setName("PUNE BYPASS PLAZA");
            p2.setOrgId("PYSN");
            p2.setAgencyId("MSRDC1");
            p2.setConcessionaireId("CON-1001");
            p2.setCategory("Toll");
            p2.setBasePricing("Distance Based");
            p2.setPlazaInterface("API");
            p2.setSubtype("State");
            p2.setAuthority("MSRDC");
            p2.setState("MAHARASHTRA");
            p2.setCity("PUNE");
            p2.setActivationDate("2026-09-05");
            p2.setGeoCode("18.7303,73.6841");
            p2.setSchemeRule("Single Return");
            p2.setSchemeDuration("24 Hrs");
            p2.setStatus("Active");
            p2.setContactAddress("Mumbai-Pune Expressway Km 94, Urse Toll Plaza, Pune, Maharashtra");
            p2.setContactNo("02027481920");
            p2.setContactMail("pune.bypass@msrdc.in");
            p2.setMdrJson("{\"bankFee\":\"0.90\",\"npciFee\":\"0.15\",\"bankGst\":\"18\",\"npciGst\":\"18\"}");
            plazas.add(p2);

            Plaza p3 = new Plaza();
            p3.setId("503303");
            p3.setName("NASHIK TOLL PLAZA");
            p3.setOrgId("PYSN");
            p3.setAgencyId("NHAI2");
            p3.setConcessionaireId("CON-1003");
            p3.setCategory("Toll");
            p3.setBasePricing("Point Based");
            p3.setPlazaInterface("API");
            p3.setSubtype("National");
            p3.setAuthority("NHAI");
            p3.setState("MAHARASHTRA");
            p3.setCity("NASHIK");
            p3.setActivationDate("2026-09-10");
            p3.setGeoCode("19.9975,73.7898");
            p3.setSchemeRule("Single Single");
            p3.setSchemeDuration("Same Day Midnight");
            p3.setStatus("Active");
            p3.setContactAddress("NH-3 Mumbai-Agra Highway, Gonde Toll Plaza, Nashik, Maharashtra");
            p3.setContactNo("02532491122");
            p3.setContactMail("nashik.plaza@nhai.gov.in");
            p3.setMdrJson("{\"bankFee\":\"0.80\",\"npciFee\":\"0.15\",\"bankGst\":\"18\",\"npciGst\":\"18\"}");
            plazas.add(p3);

            Plaza p4 = new Plaza();
            p4.setId("504404");
            p4.setName("KOLHAPUR PLAZA");
            p4.setOrgId("PYSN");
            p4.setAgencyId("NHAI2");
            p4.setConcessionaireId("CON-1003");
            p4.setCategory("Toll");
            p4.setBasePricing("Distance Based");
            p4.setPlazaInterface("API");
            p4.setSubtype("National");
            p4.setAuthority("NHAI");
            p4.setState("MAHARASHTRA");
            p4.setCity("KOLHAPUR");
            p4.setActivationDate("2026-09-12");
            p4.setGeoCode("16.7050,74.2433");
            p4.setSchemeRule("Single Return");
            p4.setSchemeDuration("24 Hrs");
            p4.setStatus("Active");
            p4.setContactAddress("NH-4 Pune-Bengaluru Highway, Kagal Toll Plaza, Kolhapur, Maharashtra");
            p4.setContactNo("02312693344");
            p4.setContactMail("kolhapur.toll@nhai.gov.in");
            p4.setMdrJson("{\"bankFee\":\"0.85\",\"npciFee\":\"0.15\",\"bankGst\":\"18\",\"npciGst\":\"18\"}");
            plazas.add(p4);

            Plaza p5 = new Plaza();
            p5.setId("505505");
            p5.setName("SOLAPUR PLAZA NH-65");
            p5.setOrgId("PYSN");
            p5.setAgencyId("NHAI3");
            p5.setConcessionaireId("CON-1002");
            p5.setCategory("Toll");
            p5.setBasePricing("Distance Based");
            p5.setPlazaInterface("API");
            p5.setSubtype("National");
            p5.setAuthority("NHAI");
            p5.setState("MAHARASHTRA");
            p5.setCity("SOLAPUR");
            p5.setActivationDate("2026-09-15");
            p5.setGeoCode("17.6599,75.9064");
            p5.setSchemeRule("Single Return");
            p5.setSchemeDuration("24 Hrs");
            p5.setStatus("Active");
            p5.setContactAddress("NH-65 Pune-Hyderabad Highway, Mohol Toll Plaza, Solapur, Maharashtra");
            p5.setContactNo("02172394455");
            p5.setContactMail("solapur.plaza@nhai.gov.in");
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
