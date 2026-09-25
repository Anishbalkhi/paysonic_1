package com.paysonic.tollops.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.paysonic.tollops.entity.*;
import com.paysonic.tollops.repository.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;

@Service
@Transactional
public class OnboardingBackendService {

    private static final Logger log = LoggerFactory.getLogger(OnboardingBackendService.class);

    private final ConcessionaireRepository concessionaireRepo;
    private final PlazaRepository plazaRepo;
    private final LaneRepository laneRepo;
    private final PlazaCallbackRepository callbackRepo;
    private final PlazaFareRepository fareRepo;
    private final PlazaCchRepository cchRepo;
    private final ObjectMapper objectMapper;

    public OnboardingBackendService(ConcessionaireRepository concessionaireRepo,
                                    PlazaRepository plazaRepo,
                                    LaneRepository laneRepo,
                                    PlazaCallbackRepository callbackRepo,
                                    PlazaFareRepository fareRepo,
                                    PlazaCchRepository cchRepo,
                                    ObjectMapper objectMapper) {
        this.concessionaireRepo = concessionaireRepo;
        this.plazaRepo = plazaRepo;
        this.laneRepo = laneRepo;
        this.callbackRepo = callbackRepo;
        this.fareRepo = fareRepo;
        this.cchRepo = cchRepo;
        this.objectMapper = objectMapper;
    }

    // ─── Concessionaires ──────────────────────────────────────────────────────────

    public List<Concessionaire> getAllConcessionaires() {
        return concessionaireRepo.findAll();
    }

    public Concessionaire saveConcessionaire(Concessionaire c) {
        if (c.getId() == null || c.getId().trim().isEmpty()) {
            c.setId("CON-" + (1000 + concessionaireRepo.count() + 1));
        }
        return concessionaireRepo.save(c);
    }

    // ─── Plazas ──────────────────────────────────────────────────────────────────

    public List<Plaza> getAllPlazas() {
        return plazaRepo.findAll();
    }

    public Optional<Plaza> getPlaza(String id) {
        return plazaRepo.findById(id);
    }

    public Plaza savePlaza(Plaza plaza) {
        return plazaRepo.save(plaza);
    }

    public void deletePlaza(String id) {
        plazaRepo.deleteById(id);
    }

    // ─── Lanes ───────────────────────────────────────────────────────────────────

    public List<Lane> getAllLanes() {
        return laneRepo.findAll();
    }

    public List<Lane> getLanesByPlaza(String plazaId) {
        return laneRepo.findByPlazaId(plazaId);
    }

    public Lane saveLane(Lane lane) {
        if (lane.getId() == null || lane.getId().trim().isEmpty()) {
            lane.setId(lane.getPlazaId() + "_" + lane.getLaneId());
        }
        return laneRepo.save(lane);
    }

    public void deleteLane(String laneId, String plazaId) {
        String id = plazaId + "_" + laneId;
        if (laneRepo.existsById(id)) {
            laneRepo.deleteById(id);
        } else {
            laneRepo.deleteByPlazaIdAndLaneId(plazaId, laneId);
        }
    }

    // ─── Callbacks ───────────────────────────────────────────────────────────────

    public Map<String, Object> getCallbacksForPlaza(String plazaId) {
        return callbackRepo.findById(plazaId)
                .map(cb -> parseJsonMap(cb.getCallbacksJson()))
                .orElse(Collections.emptyMap());
    }

    public void saveCallbacks(String plazaId, String callbacksJson) {
        PlazaCallback cb = callbackRepo.findById(plazaId)
                .orElse(new PlazaCallback(plazaId, callbacksJson));
        cb.setCallbacksJson(callbacksJson);
        cb.setUpdatedAt(LocalDateTime.now());
        callbackRepo.save(cb);
    }

    // ─── Toll Fare Matrix ────────────────────────────────────────────────────────

    public Map<String, Object> getFaresForPlaza(String plazaId) {
        return fareRepo.findById(plazaId)
                .map(f -> parseJsonMap(f.getFaresJson()))
                .orElse(Collections.emptyMap());
    }

    public void saveFares(String plazaId, String faresJson) {
        PlazaFare f = fareRepo.findById(plazaId)
                .orElse(new PlazaFare(plazaId, faresJson));
        f.setFaresJson(faresJson);
        f.setUpdatedAt(LocalDateTime.now());
        fareRepo.save(f);
    }

    // ─── CCH Mapping ─────────────────────────────────────────────────────────────

    public Map<String, Object> getCchForPlaza(String plazaId) {
        return cchRepo.findById(plazaId)
                .map(c -> parseJsonMap(c.getCchJson()))
                .orElse(Collections.emptyMap());
    }

    public void saveCch(String plazaId, String cchJson) {
        PlazaCch c = cchRepo.findById(plazaId)
                .orElse(new PlazaCch(plazaId, cchJson));
        c.setCchJson(cchJson);
        c.setUpdatedAt(LocalDateTime.now());
        cchRepo.save(c);
    }

    // ─── Full Store (Complete Live Dataset from Database) ─────────────────────────

    public Map<String, Object> getFullOnboardingStore() {
        Map<String, Object> store = new LinkedHashMap<>();

        // 1. Concessionaires
        List<Concessionaire> concessionaires = concessionaireRepo.findAll();
        store.put("concessionaires", concessionaires);

        // 2. Plazas (with MDR unpacked)
        List<Plaza> plazas = plazaRepo.findAll();
        List<Map<String, Object>> plazaList = new ArrayList<>();
        for (Plaza p : plazas) {
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("id", p.getId());
            map.put("name", p.getName());
            map.put("orgId", p.getOrgId());
            map.put("agencyId", p.getAgencyId());
            map.put("concessionaireId", p.getConcessionaireId());
            map.put("category", p.getCategory());
            map.put("basePricing", p.getBasePricing());
            map.put("plazaInterface", p.getPlazaInterface());
            map.put("subtype", p.getSubtype());
            map.put("authority", p.getAuthority());
            map.put("state", p.getState());
            map.put("city", p.getCity());
            map.put("activationDate", p.getActivationDate());
            map.put("geoCode", p.getGeoCode());
            map.put("schemeRule", p.getSchemeRule());
            map.put("schemeDuration", p.getSchemeDuration());
            map.put("status", p.getStatus());
            map.put("publicKey", p.getPublicKey());
            map.put("contactAddress", p.getContactAddress());
            map.put("contactNo", p.getContactNo());
            map.put("contactMail", p.getContactMail());
            map.put("mdr", parseJsonMap(p.getMdrJson()));
            map.put("_source", "REAL_DATABASE");
            plazaList.add(map);
        }
        store.put("plazas", plazaList);

        // 3. Lanes
        store.put("lanes", laneRepo.findAll());

        // 4. Callbacks (keyed by plazaId)
        Map<String, Object> callbacksMap = new LinkedHashMap<>();
        for (PlazaCallback cb : callbackRepo.findAll()) {
            callbacksMap.put(cb.getPlazaId(), parseJsonMap(cb.getCallbacksJson()));
        }
        store.put("callbacks", callbacksMap);

        // 5. Fares (keyed by plazaId)
        Map<String, Object> faresMap = new LinkedHashMap<>();
        for (PlazaFare f : fareRepo.findAll()) {
            faresMap.put(f.getPlazaId(), parseJsonMap(f.getFaresJson()));
        }
        store.put("fares", faresMap);

        // 6. CCH (keyed by plazaId)
        Map<String, Object> cchMap = new LinkedHashMap<>();
        for (PlazaCch c : cchRepo.findAll()) {
            cchMap.put(c.getPlazaId(), parseJsonMap(c.getCchJson()));
        }
        store.put("cch", cchMap);

        store.put("source", "LIVE_BACKEND_DB");
        store.put("retrievedAt", LocalDateTime.now().toString());

        return store;
    }

    private Map<String, Object> parseJsonMap(String json) {
        if (json == null || json.trim().isEmpty()) {
            return Collections.emptyMap();
        }
        try {
            return objectMapper.readValue(json, new TypeReference<Map<String, Object>>() {});
        } catch (Exception e) {
            log.warn("Failed to parse JSON map in OnboardingBackendService: {}", e.getMessage());
            return Collections.emptyMap();
        }
    }
}
