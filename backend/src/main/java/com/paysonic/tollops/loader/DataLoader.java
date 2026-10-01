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
import java.math.BigDecimal;
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
    private final TollTransactionRepository tollTransactionRepository;
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
                      TollTransactionRepository tollTransactionRepository,
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
        this.tollTransactionRepository = tollTransactionRepository;
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
            seedTollTransactions();
            seedCycleWiseTransactions();
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

    private void seedTollTransactions() {
        if (tollTransactionRepository.count() > 0) {
            log.info("Toll transactions table already contains {} records, skipping seed.", tollTransactionRepository.count());
            return;
        }

        List<TollTransaction> txns = new ArrayList<>();
        LocalDateTime now = LocalDateTime.now();

        // 1. Reference Screenshot Row 1 (Dummytoll 600601, Rejected, MALTAG)
        TollTransaction t1 = new TollTransaction();
        t1.setTollFileName("ONLINE");
        t1.setPlazaId("600601");
        t1.setPlazaName("Dummytoll");
        t1.setLaneId("L4");
        t1.setTagId("34161FA82032890123456781");
        t1.setVrn("MH12VL3456");
        t1.setAcqTxnId("102047738012345671");
        t1.setTollTxnId("ZP170908");
        t1.setTollMessageId("ZP170908");
        t1.setMvc("VC4");
        t1.setTagVc("4");
        t1.setAvc("VC4");
        t1.setStatus("Rejected");
        t1.setReason("MALTAG");
        t1.setTxnAmount(BigDecimal.ZERO);
        t1.setSettledAmount(null);
        t1.setTxnDate(LocalDateTime.of(2026, 9, 15, 10, 30, 0));
        t1.setPlazaPostDate(LocalDateTime.of(2026, 9, 21, 12, 0, 0));
        t1.setNpciRespDate(LocalDateTime.of(2026, 9, 21, 12, 5, 0));
        t1.setPlazaType("Toll");
        t1.setIsViolation("Yes");
        t1.setAuditVc("NA");
        t1.setViolationSettledAmount(BigDecimal.ZERO);
        txns.add(t1);

        // 2. Reference Screenshot Row 2 (Dummytoll 600601, Rejected, DUPLICATE)
        TollTransaction t2 = new TollTransaction();
        t2.setTollFileName("ONLINE");
        t2.setPlazaId("600601");
        t2.setPlazaName("Dummytoll");
        t2.setLaneId("L4");
        t2.setTagId("34161FA82032890123456782");
        t2.setVrn("MH12VL3457");
        t2.setAcqTxnId("102047738012345672");
        t2.setTollTxnId("ZP170907");
        t2.setTollMessageId("ZP170907");
        t2.setMvc("VC4");
        t2.setTagVc("4");
        t2.setAvc("VC4");
        t2.setStatus("Rejected");
        t2.setReason("DUPLICATE");
        t2.setTxnAmount(BigDecimal.ZERO);
        t2.setSettledAmount(null);
        t2.setTxnDate(LocalDateTime.of(2026, 9, 15, 11, 15, 0));
        t2.setPlazaPostDate(LocalDateTime.of(2026, 9, 21, 12, 0, 0));
        t2.setNpciRespDate(LocalDateTime.of(2026, 9, 21, 12, 5, 0));
        t2.setPlazaType("Toll");
        t2.setIsViolation("Yes");
        t2.setAuditVc("NA");
        t2.setViolationSettledAmount(BigDecimal.ZERO);
        txns.add(t2);

        // 3. Reference Screenshot Row 3 (Autumn 666666, Pending, ACCEPTED)
        TollTransaction t3 = new TollTransaction();
        t3.setTollFileName("ONLINE");
        t3.setPlazaId("666666");
        t3.setPlazaName("Autumn");
        t3.setLaneId("L2");
        t3.setTagId("34161FA82032890123456783");
        t3.setVrn("MH04ID2901");
        t3.setAcqTxnId("102047738012345673");
        t3.setTollTxnId("AM170907");
        t3.setTollMessageId("AM170907");
        t3.setMvc("VC10");
        t3.setTagVc("4");
        t3.setAvc("VC10");
        t3.setStatus("Pending");
        t3.setReason("ACCEPTED");
        t3.setTxnAmount(new BigDecimal("120.00"));
        t3.setSettledAmount(BigDecimal.ZERO);
        t3.setTxnDate(LocalDateTime.of(2026, 9, 16, 8, 20, 0));
        t3.setPlazaPostDate(LocalDateTime.of(2026, 9, 17, 9, 0, 0));
        t3.setTxnType("DEBIT");
        t3.setNpciRespDate(LocalDateTime.of(2026, 9, 17, 9, 5, 0));
        t3.setPlazaType("Toll");
        t3.setIsViolation("Yes");
        t3.setAuditVc("VC18");
        t3.setViolationSettledAmount(BigDecimal.ZERO);
        txns.add(t3);

        // 4. Reference Screenshot Row 4 (Autumn 666666, Pending, ACCEPTED)
        TollTransaction t4 = new TollTransaction();
        t4.setTollFileName("ONLINE");
        t4.setPlazaId("666666");
        t4.setPlazaName("Autumn");
        t4.setLaneId("L2");
        t4.setTagId("34161FA82032890123456784");
        t4.setVrn("MH04ID2902");
        t4.setAcqTxnId("102047738012345674");
        t4.setTollTxnId("AM170906");
        t4.setTollMessageId("AM170906");
        t4.setMvc("VC10");
        t4.setTagVc("4");
        t4.setAvc("VC10");
        t4.setStatus("Pending");
        t4.setReason("ACCEPTED");
        t4.setTxnAmount(new BigDecimal("120.00"));
        t4.setSettledAmount(BigDecimal.ZERO);
        t4.setTxnDate(LocalDateTime.of(2026, 9, 16, 9, 45, 0));
        t4.setPlazaPostDate(LocalDateTime.of(2026, 9, 17, 10, 0, 0));
        t4.setTxnType("DEBIT");
        t4.setNpciRespDate(LocalDateTime.of(2026, 9, 17, 10, 5, 0));
        t4.setPlazaType("Toll");
        t4.setIsViolation("Yes");
        t4.setAuditVc("Decline");
        t4.setViolationSettledAmount(BigDecimal.ZERO);
        txns.add(t4);

        // 5. Reference Screenshot Row 5 (Autumn 666666, Rejected, MALTAG)
        TollTransaction t5 = new TollTransaction();
        t5.setTollFileName("ONLINE");
        t5.setPlazaId("666666");
        t5.setPlazaName("Autumn");
        t5.setLaneId("L2");
        t5.setTagId("34161FA82032890123456785");
        t5.setVrn("MH04ID2903");
        t5.setAcqTxnId("102047738012345675");
        t5.setTollTxnId("AM170905");
        t5.setTollMessageId("AM170905");
        t5.setMvc("VC10");
        t5.setTagVc("4");
        t5.setAvc("VC10");
        t5.setStatus("Rejected");
        t5.setReason("MALTAG");
        t5.setTxnAmount(BigDecimal.ZERO);
        t5.setSettledAmount(null);
        t5.setTxnDate(LocalDateTime.of(2026, 9, 16, 11, 10, 0));
        t5.setPlazaPostDate(LocalDateTime.of(2026, 9, 17, 12, 0, 0));
        t5.setNpciRespDate(LocalDateTime.of(2026, 9, 17, 12, 5, 0));
        t5.setPlazaType("Toll");
        t5.setIsViolation("Yes");
        t5.setAuditVc("Decline");
        t5.setViolationSettledAmount(BigDecimal.ZERO);
        txns.add(t5);

        // 6-12. Seed today's operational transactions so opening TRS with default range displays live data
        String[] statuses = {"Settled", "Settled", "Pending", "Settled", "Rejected", "Declined"};
        String[] reasons = {"ACCEPTED", "ACCEPTED", "ACCEPTED", "ACCEPTED", "BLKLISTTAG", "LOW_BAL"};
        BigDecimal[] txnAmts = {new BigDecimal("85.00"), new BigDecimal("130.00"), new BigDecimal("95.00"), new BigDecimal("240.00"), BigDecimal.ZERO, new BigDecimal("85.00")};
        BigDecimal[] setAmts = {new BigDecimal("85.00"), new BigDecimal("130.00"), BigDecimal.ZERO, new BigDecimal("240.00"), null, null};
        String[] cycles = {"C1", "C2", "", "C1", "", ""};
        String[] vcs = {"VC4", "VC5", "VC4", "VC10", "VC4", "VC4"};
        String[] vrns = {"MH12AB1001", "KA03CD2002", "DL01EF3003", "TS07GH4004", "UP16IJ5005", "HR26KL6006"};

        for (int i = 0; i < statuses.length; i++) {
            TollTransaction t = new TollTransaction();
            t.setTollFileName("ONLINE");
            t.setPlazaId(i % 2 == 0 ? "501101" : "502202");
            t.setPlazaName(i % 2 == 0 ? "MUMBAI PLAZA NH-04" : "PUNE BYPASS PLAZA");
            t.setLaneId("L" + (i + 1));
            t.setTagId("34161FA820328909988100" + i);
            t.setVrn(vrns[i]);
            t.setAcqTxnId("1020477380998810" + String.format("%02d", i + 10));
            t.setTollTxnId("TXN2610" + String.format("%04d", i + 1));
            t.setTollMessageId("MSG2610" + String.format("%04d", i + 1));
            t.setMvc(vcs[i]);
            t.setTagVc(vcs[i].replace("VC", ""));
            t.setAvc(vcs[i]);
            t.setStatus(statuses[i]);
            t.setReason(reasons[i]);
            t.setTxnAmount(txnAmts[i]);
            t.setSettledAmount(setAmts[i]);
            t.setTxnDate(now.minusHours(i * 2 + 1));
            t.setPlazaPostDate(now.minusHours(i * 2));
            t.setNpciRespDate(now.minusHours(i * 2).plusMinutes(3));
            if ("Settled".equals(statuses[i])) {
                t.setNpciSettledDate(now.minusHours(i * 2).plusMinutes(30));
                t.setClearingCycle(cycles[i]);
                t.setPlazaSettleDate(now.minusHours(i * 2).plusHours(2));
                t.setTxnType("DEBIT");
            } else if ("Pending".equals(statuses[i])) {
                t.setTxnType("DEBIT");
            }
            t.setPlazaType("Toll");
            t.setIsViolation(i == 4 ? "Yes" : "No");
            t.setAuditVc(i == 4 ? "Decline" : "NA");
            t.setViolationSettledAmount(BigDecimal.ZERO);
            txns.add(t);
        }

        // 13-16. Reference Screenshot Rows for Date Wise Recon (Plaza 600601, Dummytollplaza1, Txn Date 07-08-2026)
        LocalDateTime august7 = LocalDateTime.of(2026, 8, 7, 10, 30, 0);
        LocalDateTime august4Settled = LocalDateTime.of(2026, 8, 4, 14, 0, 0);
        LocalDateTime august5Settled = LocalDateTime.of(2026, 8, 5, 14, 0, 0);

        for (int k = 1; k <= 4; k++) {
            TollTransaction dk = new TollTransaction();
            dk.setTollFileName("ONLINE");
            dk.setPlazaId("600601");
            dk.setPlazaName("Dummytollplaza1");
            dk.setLaneId("L0" + k);
            dk.setTagId("34161FA820328909988109" + k);
            dk.setVrn("MH12DT000" + k);
            dk.setAcqTxnId("10204773809988109" + k);
            dk.setTollTxnId("TXNDUMMY" + k);
            dk.setTollMessageId("MSGDUMMY" + k);
            dk.setMvc("VC4");
            dk.setTagVc("4");
            dk.setAvc("VC4");
            dk.setStatus("Settled");
            dk.setReason("ACCEPTED");
            dk.setTxnAmount(new BigDecimal("51.50"));
            dk.setSettledAmount(new BigDecimal("51.50")); // Total 2 txns = 103.00
            dk.setTxnDate(august7.plusMinutes(k * 15));
            dk.setPlazaPostDate(august7.plusMinutes(k * 15 + 2));
            dk.setNpciRespDate(august7.plusMinutes(k * 15 + 3));
            dk.setNpciSettledDate(k <= 2 ? august4Settled : august5Settled);
            dk.setClearingCycle(k <= 2 ? "C1" : "C2");
            dk.setPlazaSettleDate(k <= 2 ? august4Settled.plusHours(2) : august5Settled.plusHours(2));
            dk.setTxnType("DEBIT");
            dk.setPlazaType("Toll");
            dk.setIsViolation("No");
            dk.setAuditVc("NA");
            dk.setViolationSettledAmount(BigDecimal.ZERO);
            txns.add(dk);
        }

        tollTransactionRepository.saveAll(txns);
        log.info("Seeded {} initial Toll Transactions for TRS Report.", txns.size());
    }

    private void seedCycleWiseTransactions() {
        if (tollTransactionRepository.countByPlazaId("600602") > 0) {
            log.info("Cycle wise transactions already present, skipping seed.");
            return;
        }

        List<TollTransaction> list = new ArrayList<>();
        String[] plazas = {"600601", "600602"};
        String[] plazaNames = {"Dummytollplaza1", "Dummytollplaza2"};

        for (int p = 0; p < plazas.length; p++) {
            String pId = plazas[p];
            String pName = plazaNames[p];

            // 1. Settlement Date 02-08-2026, Cycle 2 (5 txns, 125.00)
            LocalDateTime d1 = LocalDateTime.of(2026, 8, 2, 10, 0, 0);
            LocalDateTime s1 = LocalDateTime.of(2026, 8, 2, 14, 0, 0);
            for (int i = 1; i <= 5; i++) {
                TollTransaction t = new TollTransaction();
                t.setTollFileName("ONLINE");
                t.setPlazaId(pId);
                t.setPlazaName(pName);
                t.setLaneId("L01");
                t.setTagId("34161FA82032890" + pId + "2" + i);
                t.setVrn("MH12CW" + pId.substring(3) + "0" + i);
                t.setAcqTxnId("1020477" + pId + "20" + i);
                t.setTollTxnId("TXNCW" + pId + "20" + i);
                t.setTollMessageId("MSGCW" + pId + "20" + i);
                t.setMvc("VC4");
                t.setTagVc("4");
                t.setAvc("VC4");
                t.setStatus("Settled");
                t.setReason("ACCEPTED");
                t.setTxnAmount(new BigDecimal("25.00"));
                t.setSettledAmount(new BigDecimal("25.00"));
                t.setTxnDate(d1.plusMinutes(i * 10));
                t.setPlazaPostDate(d1.plusMinutes(i * 10 + 2));
                t.setNpciRespDate(d1.plusMinutes(i * 10 + 3));
                t.setNpciSettledDate(s1);
                t.setPlazaSettleDate(s1);
                t.setClearingCycle("2");
                t.setTxnType("DEBIT");
                t.setPlazaType("Toll");
                t.setIsViolation("No");
                t.setIsDisputeAdd("No");
                t.setIsDisputeSub("No");
                list.add(t);
            }

            // 2. Settlement Date 03-08-2026, Cycle 1 (3 txns = 75.00 + 3 dispute add = 60.00 -> Total 135.00)
            LocalDateTime d2 = LocalDateTime.of(2026, 8, 3, 9, 0, 0);
            LocalDateTime s2 = LocalDateTime.of(2026, 8, 3, 12, 0, 0);
            for (int i = 1; i <= 3; i++) {
                TollTransaction t = new TollTransaction();
                t.setTollFileName("ONLINE");
                t.setPlazaId(pId);
                t.setPlazaName(pName);
                t.setLaneId("L02");
                t.setTagId("34161FA82032890" + pId + "1" + i);
                t.setVrn("MH12CW" + pId.substring(3) + "1" + i);
                t.setAcqTxnId("1020477" + pId + "10" + i);
                t.setTollTxnId("TXNCW" + pId + "10" + i);
                t.setTollMessageId("MSGCW" + pId + "10" + i);
                t.setMvc("VC4");
                t.setTagVc("4");
                t.setAvc("VC4");
                t.setStatus("Settled");
                t.setReason("ACCEPTED");
                t.setTxnAmount(new BigDecimal("25.00"));
                t.setSettledAmount(new BigDecimal("25.00"));
                t.setTxnDate(d2.plusMinutes(i * 10));
                t.setPlazaPostDate(d2.plusMinutes(i * 10 + 2));
                t.setNpciRespDate(d2.plusMinutes(i * 10 + 3));
                t.setNpciSettledDate(s2);
                t.setPlazaSettleDate(s2);
                t.setClearingCycle("1");
                t.setTxnType("DEBIT");
                t.setPlazaType("Toll");
                t.setIsViolation("No");
                t.setIsDisputeAdd("No");
                t.setIsDisputeSub("No");
                list.add(t);
            }

            // 3 dispute add adjustments (20.00 each)
            for (int i = 1; i <= 3; i++) {
                TollTransaction disp = new TollTransaction();
                disp.setTollFileName("ONLINE");
                disp.setPlazaId(pId);
                disp.setPlazaName(pName);
                disp.setLaneId("L02");
                disp.setTagId("34161FA82032890" + pId + "D" + i);
                disp.setVrn("MH12CW" + pId.substring(3) + "D" + i);
                disp.setAcqTxnId("1020477" + pId + "D0" + i);
                disp.setTollTxnId("TXNDISP" + pId + "10" + i);
                disp.setTollMessageId("MSGDISP" + pId + "10" + i);
                disp.setMvc("VC4");
                disp.setTagVc("4");
                disp.setAvc("VC4");
                disp.setStatus("Settled");
                disp.setReason("DISPUTE_CREDIT");
                disp.setTxnAmount(BigDecimal.ZERO);
                disp.setSettledAmount(new BigDecimal("20.00"));
                disp.setDisputeAddAmount(new BigDecimal("20.00"));
                disp.setIsDisputeAdd("Yes");
                disp.setIsDisputeSub("No");
                disp.setTxnDate(d2.plusMinutes(40 + i * 5));
                disp.setPlazaPostDate(d2.plusMinutes(40 + i * 5 + 2));
                disp.setNpciRespDate(d2.plusMinutes(40 + i * 5 + 3));
                disp.setNpciSettledDate(s2);
                disp.setPlazaSettleDate(s2);
                disp.setClearingCycle("1");
                disp.setTxnType("CREDIT");
                disp.setPlazaType("Toll");
                disp.setIsViolation("No");
                list.add(disp);
            }

            // 3. Settlement Date 03-08-2026, Cycle 3 (4 txns: 2 of 26.00 + 2 of 25.50 = 103.00)
            LocalDateTime d3 = LocalDateTime.of(2026, 8, 3, 14, 0, 0);
            LocalDateTime s3 = LocalDateTime.of(2026, 8, 3, 18, 0, 0);
            BigDecimal[] c3Amts = {new BigDecimal("26.00"), new BigDecimal("26.00"), new BigDecimal("25.50"), new BigDecimal("25.50")};
            for (int i = 1; i <= 4; i++) {
                TollTransaction t = new TollTransaction();
                t.setTollFileName("ONLINE");
                t.setPlazaId(pId);
                t.setPlazaName(pName);
                t.setLaneId("L03");
                t.setTagId("34161FA82032890" + pId + "3" + i);
                t.setVrn("MH12CW" + pId.substring(3) + "3" + i);
                t.setAcqTxnId("1020477" + pId + "30" + i);
                t.setTollTxnId("TXNCW" + pId + "30" + i);
                t.setTollMessageId("MSGCW" + pId + "30" + i);
                t.setMvc("VC4");
                t.setTagVc("4");
                t.setAvc("VC4");
                t.setStatus("Settled");
                t.setReason("ACCEPTED");
                t.setTxnAmount(c3Amts[i - 1]);
                t.setSettledAmount(c3Amts[i - 1]);
                t.setTxnDate(d3.plusMinutes(i * 10));
                t.setPlazaPostDate(d3.plusMinutes(i * 10 + 2));
                t.setNpciRespDate(d3.plusMinutes(i * 10 + 3));
                t.setNpciSettledDate(s3);
                t.setPlazaSettleDate(s3);
                t.setClearingCycle("3");
                t.setTxnType("DEBIT");
                t.setPlazaType("Toll");
                t.setIsViolation("No");
                t.setIsDisputeAdd("No");
                t.setIsDisputeSub("No");
                list.add(t);
            }
        }

        tollTransactionRepository.saveAll(list);
        log.info("Seeded {} Cycle Wise Reconciliation transactions for Plazas 600601 & 600602.", list.size());
    }
}

