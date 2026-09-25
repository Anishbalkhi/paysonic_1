package com.paysonic.tollops.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.paysonic.tollops.entity.Concessionaire;
import com.paysonic.tollops.entity.Lane;
import com.paysonic.tollops.entity.Plaza;
import com.paysonic.tollops.service.OnboardingBackendService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")
public class OnboardingController {

    private static final Logger log = LoggerFactory.getLogger(OnboardingController.class);

    private final OnboardingBackendService onboardingService;
    private final ObjectMapper objectMapper;

    public OnboardingController(OnboardingBackendService onboardingService, ObjectMapper objectMapper) {
        this.onboardingService = onboardingService;
        this.objectMapper = objectMapper;
    }

    // ─── Complete Store ──────────────────────────────────────────────────────────

    @GetMapping("/onboarding/all")
    public ResponseEntity<Map<String, Object>> getFullStore() {
        return ResponseEntity.ok(onboardingService.getFullOnboardingStore());
    }

    // ─── Plazas ──────────────────────────────────────────────────────────────────

    @GetMapping("/plazas")
    public ResponseEntity<List<Plaza>> getPlazas() {
        return ResponseEntity.ok(onboardingService.getAllPlazas());
    }

    @GetMapping("/plazas/{id}")
    public ResponseEntity<Plaza> getPlazaById(@PathVariable String id) {
        return onboardingService.getPlaza(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/plazas")
    public ResponseEntity<Plaza> createPlaza(@RequestBody Map<String, Object> body) {
        Plaza plaza = mapToPlaza(body);
        Plaza saved = onboardingService.savePlaza(plaza);
        log.info("Created Plaza in Database: {} ({})", saved.getName(), saved.getId());
        return ResponseEntity.ok(saved);
    }

    @PutMapping("/plazas/{id}")
    public ResponseEntity<Plaza> updatePlaza(@PathVariable String id, @RequestBody Map<String, Object> body) {
        Plaza plaza = mapToPlaza(body);
        plaza.setId(id);
        Plaza saved = onboardingService.savePlaza(plaza);
        log.info("Updated Plaza in Database: {} ({})", saved.getName(), saved.getId());
        return ResponseEntity.ok(saved);
    }

    @DeleteMapping("/plazas/{id}")
    public ResponseEntity<Map<String, Object>> deletePlaza(@PathVariable String id) {
        onboardingService.deletePlaza(id);
        return ResponseEntity.ok(Map.of("success", true, "deletedId", id));
    }

    // ─── Concessionaires ──────────────────────────────────────────────────────────

    @GetMapping("/concessionaires")
    public ResponseEntity<List<Concessionaire>> getConcessionaires() {
        return ResponseEntity.ok(onboardingService.getAllConcessionaires());
    }

    @PostMapping("/concessionaires")
    public ResponseEntity<Concessionaire> createConcessionaire(@RequestBody Concessionaire c) {
        Concessionaire saved = onboardingService.saveConcessionaire(c);
        log.info("Created Concessionaire in Database: {} ({})", saved.getName(), saved.getId());
        return ResponseEntity.ok(saved);
    }

    // ─── Lanes ───────────────────────────────────────────────────────────────────

    @GetMapping("/plazas/lanes")
    public ResponseEntity<List<Lane>> getLanes(@RequestParam(required = false) String plazaId) {
        if (plazaId != null && !plazaId.trim().isEmpty()) {
            return ResponseEntity.ok(onboardingService.getLanesByPlaza(plazaId));
        }
        return ResponseEntity.ok(onboardingService.getAllLanes());
    }

    @PostMapping("/plazas/lanes")
    public ResponseEntity<Lane> saveLane(@RequestBody Lane lane) {
        Lane saved = onboardingService.saveLane(lane);
        log.info("Saved Lane in Database: Plaza {} -> Lane {}", saved.getPlazaId(), saved.getLaneId());
        return ResponseEntity.ok(saved);
    }

    @DeleteMapping("/plazas/lanes")
    public ResponseEntity<Map<String, Object>> deleteLane(@RequestBody Map<String, String> body) {
        String laneId = body.get("laneId");
        String plazaId = body.get("plazaId");
        if (laneId != null && plazaId != null) {
            onboardingService.deleteLane(laneId, plazaId);
            log.info("Deleted Lane from Database: Plaza {} -> Lane {}", plazaId, laneId);
        }
        return ResponseEntity.ok(Map.of("success", true));
    }

    // ─── Callbacks ───────────────────────────────────────────────────────────────

    @PutMapping("/plazas/callbacks")
    public ResponseEntity<Map<String, Object>> saveCallbacks(@RequestBody Map<String, Object> body) {
        String plazaId = (String) body.get("plazaId");
        Object urls = body.get("callbackUrls");
        if (plazaId != null && urls != null) {
            try {
                String json = objectMapper.writeValueAsString(urls);
                onboardingService.saveCallbacks(plazaId, json);
                log.info("Saved Callbacks in Database for Plaza {}", plazaId);
            } catch (Exception e) {
                return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
            }
        }
        return ResponseEntity.ok(Map.of("success", true, "plazaId", plazaId));
    }

    // ─── Toll Fare Matrix ────────────────────────────────────────────────────────

    @PutMapping("/plazas/fares")
    public ResponseEntity<Map<String, Object>> saveFares(@RequestBody Map<String, Object> body) {
        String plazaId = (String) body.get("plazaId");
        Object fares = body.get("fares");
        if (plazaId != null && fares != null) {
            try {
                String json = objectMapper.writeValueAsString(fares);
                onboardingService.saveFares(plazaId, json);
                log.info("Saved Toll Fare Matrix in Database for Plaza {}", plazaId);
            } catch (Exception e) {
                return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
            }
        }
        return ResponseEntity.ok(Map.of("success", true, "plazaId", plazaId));
    }

    // ─── CCH Mapping ─────────────────────────────────────────────────────────────

    @PutMapping("/plazas/cch")
    public ResponseEntity<Map<String, Object>> saveCch(@RequestBody Map<String, Object> body) {
        String plazaId = (String) body.get("plazaId");
        Object cch = body.get("cch");
        if (plazaId != null && cch != null) {
            try {
                String json = objectMapper.writeValueAsString(cch);
                onboardingService.saveCch(plazaId, json);
                log.info("Saved CCH Mapping in Database for Plaza {}", plazaId);
            } catch (Exception e) {
                return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
            }
        }
        return ResponseEntity.ok(Map.of("success", true, "plazaId", plazaId));
    }

    // ─── Helper: Map request body to Plaza entity ─────────────────────────────────

    private Plaza mapToPlaza(Map<String, Object> map) {
        Plaza p = new Plaza();
        if (map.containsKey("plazaId")) p.setId(String.valueOf(map.get("plazaId")));
        if (map.containsKey("id")) p.setId(String.valueOf(map.get("id")));
        if (map.containsKey("name")) p.setName((String) map.get("name"));
        if (map.containsKey("orgId")) p.setOrgId((String) map.get("orgId"));
        if (map.containsKey("agencyId")) p.setAgencyId((String) map.get("agencyId"));
        if (map.containsKey("concessionaireId")) p.setConcessionaireId(String.valueOf(map.get("concessionaireId")));
        if (map.containsKey("category")) p.setCategory((String) map.get("category"));
        if (map.containsKey("basePricing")) p.setBasePricing((String) map.get("basePricing"));
        if (map.containsKey("plazaInterface")) p.setPlazaInterface((String) map.get("plazaInterface"));
        if (map.containsKey("subtype")) p.setSubtype((String) map.get("subtype"));
        if (map.containsKey("authority")) p.setAuthority((String) map.get("authority"));
        if (map.containsKey("state")) p.setState((String) map.get("state"));
        if (map.containsKey("city")) p.setCity((String) map.get("city"));
        if (map.containsKey("activationDate")) p.setActivationDate((String) map.get("activationDate"));
        if (map.containsKey("geoCode")) p.setGeoCode((String) map.get("geoCode"));
        if (map.containsKey("schemeRule")) p.setSchemeRule((String) map.get("schemeRule"));
        if (map.containsKey("schemeDuration")) p.setSchemeDuration((String) map.get("schemeDuration"));
        if (map.containsKey("status")) p.setStatus((String) map.get("status"));
        if (map.containsKey("publicKey")) p.setPublicKey((String) map.get("publicKey"));
        if (map.containsKey("contactAddress")) p.setContactAddress((String) map.get("contactAddress"));
        if (map.containsKey("contactNo")) p.setContactNo((String) map.get("contactNo"));
        if (map.containsKey("contactMail")) p.setContactMail((String) map.get("contactMail"));

        if (map.containsKey("mdr")) {
            try {
                p.setMdrJson(objectMapper.writeValueAsString(map.get("mdr")));
            } catch (Exception e) {
                p.setMdrJson("{}");
            }
        }
        return p;
    }
}
