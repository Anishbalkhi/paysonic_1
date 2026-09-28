package com.paysonic.tollops.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.paysonic.tollops.entity.Concessionaire;
import com.paysonic.tollops.entity.Lane;
import com.paysonic.tollops.entity.Plaza;
import com.paysonic.tollops.service.OnboardingBackendService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
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
    public ResponseEntity<?> createPlaza(@RequestBody Map<String, Object> body) {
        Plaza plaza = mapToPlaza(body);

        // Validation: Unique Plaza ID
        if (plaza.getId() == null || plaza.getId().trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Plaza ID is required"));
        }
        if (onboardingService.plazaExists(plaza.getId())) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of("error", "Plaza ID " + plaza.getId() + " is already onboarded across the network"));
        }

        // Referential integrity: Valid Concessionaire ID required
        if (plaza.getConcessionaireId() == null || plaza.getConcessionaireId().trim().isEmpty() ||
                !onboardingService.concessionaireExists(plaza.getConcessionaireId())) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "A valid Concessionaire ID is required to onboard a Plaza"));
        }

        Plaza saved = onboardingService.savePlaza(plaza);
        log.info("Created Plaza in Database: {} ({})", saved.getName(), saved.getId());
        return ResponseEntity.ok(saved);
    }

    @PutMapping("/plazas/{id}")
    public ResponseEntity<?> updatePlaza(@PathVariable String id, @RequestBody Map<String, Object> body) {
        Plaza plaza = mapToPlaza(body);
        plaza.setId(id);

        if (plaza.getConcessionaireId() != null && !plaza.getConcessionaireId().trim().isEmpty() &&
                !onboardingService.concessionaireExists(plaza.getConcessionaireId())) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Selected Concessionaire ID does not exist"));
        }

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
    public ResponseEntity<?> saveLane(@RequestBody Lane lane) {
        if (lane.getPlazaId() == null || !onboardingService.plazaExists(lane.getPlazaId())) {
            return ResponseEntity.badRequest().body(Map.of("error", "Lane cannot be saved without a valid Plaza ID"));
        }
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

    @PutMapping({"/plazas/callbacks", "/plazas/{plazaId}/callbacks"})
    public ResponseEntity<Map<String, Object>> saveCallbacks(
            @PathVariable(required = false) String plazaId,
            @RequestBody Map<String, Object> body) {
        String effectivePlazaId = plazaId != null ? plazaId : (String) body.get("plazaId");
        if (effectivePlazaId == null || !onboardingService.plazaExists(effectivePlazaId)) {
            return ResponseEntity.badRequest().body(Map.of("error", "Callbacks cannot be saved without a valid Plaza ID"));
        }
        Object urls = body.containsKey("callbacks") ? body.get("callbacks") : body.get("callbackUrls");
        if (urls != null) {
            try {
                String json = objectMapper.writeValueAsString(urls);
                onboardingService.saveCallbacks(effectivePlazaId, json);
                log.info("Saved Callbacks in Database for Plaza {}", effectivePlazaId);
            } catch (Exception e) {
                return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
            }
        }
        return ResponseEntity.ok(Map.of("success", true, "plazaId", effectivePlazaId));
    }

    // ─── Toll Fare Matrix ────────────────────────────────────────────────────────

    @PutMapping({"/plazas/fares", "/plazas/{plazaId}/fares"})
    public ResponseEntity<Map<String, Object>> saveFares(
            @PathVariable(required = false) String plazaId,
            @RequestBody Map<String, Object> body) {
        String effectivePlazaId = plazaId != null ? plazaId : (String) body.get("plazaId");
        if (effectivePlazaId == null || !onboardingService.plazaExists(effectivePlazaId)) {
            return ResponseEntity.badRequest().body(Map.of("error", "Fare mapping cannot be saved without a valid Plaza ID"));
        }
        Object fares = body.get("fares");
        if (fares != null) {
            try {
                String json = objectMapper.writeValueAsString(fares);
                onboardingService.saveFares(effectivePlazaId, json);
                log.info("Saved Toll Fare Matrix in Database for Plaza {}", effectivePlazaId);
            } catch (Exception e) {
                return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
            }
        }
        return ResponseEntity.ok(Map.of("success", true, "plazaId", effectivePlazaId));
    }

    // ─── CCH Mapping ─────────────────────────────────────────────────────────────

    @PutMapping({"/plazas/cch", "/plazas/{plazaId}/cch"})
    public ResponseEntity<Map<String, Object>> saveCch(
            @PathVariable(required = false) String plazaId,
            @RequestBody Map<String, Object> body) {
        String effectivePlazaId = plazaId != null ? plazaId : (String) body.get("plazaId");
        if (effectivePlazaId == null || !onboardingService.plazaExists(effectivePlazaId)) {
            return ResponseEntity.badRequest().body(Map.of("error", "CCH mapping cannot be saved without a valid Plaza ID"));
        }
        Object cch = body.get("cch");
        if (cch != null) {
            try {
                String json = objectMapper.writeValueAsString(cch);
                onboardingService.saveCch(effectivePlazaId, json);
                log.info("Saved CCH Mapping in Database for Plaza {}", effectivePlazaId);
            } catch (Exception e) {
                return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
            }
        }
        return ResponseEntity.ok(Map.of("success", true, "plazaId", effectivePlazaId));
    }

    // ─── Helper: Map request body to Plaza entity ─────────────────────────────────

    private Plaza mapToPlaza(Map<String, Object> map) {
        Plaza p = new Plaza();
        if (map.containsKey("plazaId") && map.get("plazaId") != null) p.setId(String.valueOf(map.get("plazaId")).trim());
        if (map.containsKey("id") && map.get("id") != null) p.setId(String.valueOf(map.get("id")).trim());

        // Global Business Rule: All text values stored in uppercase
        if (map.containsKey("name") && map.get("name") != null) p.setName(((String) map.get("name")).trim().toUpperCase());
        if (map.containsKey("orgId") && map.get("orgId") != null) p.setOrgId(((String) map.get("orgId")).trim().toUpperCase());
        if (map.containsKey("agencyId") && map.get("agencyId") != null) p.setAgencyId(((String) map.get("agencyId")).trim().toUpperCase());
        if (map.containsKey("concessionaireId") && map.get("concessionaireId") != null) p.setConcessionaireId(String.valueOf(map.get("concessionaireId")).trim().toUpperCase());
        if (map.containsKey("category") && map.get("category") != null) p.setCategory((String) map.get("category"));
        if (map.containsKey("basePricing") && map.get("basePricing") != null) p.setBasePricing((String) map.get("basePricing"));
        if (map.containsKey("plazaInterface") && map.get("plazaInterface") != null) p.setPlazaInterface((String) map.get("plazaInterface"));
        if (map.containsKey("subtype") && map.get("subtype") != null) p.setSubtype((String) map.get("subtype"));
        if (map.containsKey("authority") && map.get("authority") != null) p.setAuthority((String) map.get("authority"));
        if (map.containsKey("state") && map.get("state") != null) p.setState(((String) map.get("state")).trim().toUpperCase());
        if (map.containsKey("city") && map.get("city") != null) p.setCity(((String) map.get("city")).trim().toUpperCase());
        if (map.containsKey("activationDate") && map.get("activationDate") != null) p.setActivationDate((String) map.get("activationDate"));
        if (map.containsKey("geoCode") && map.get("geoCode") != null) p.setGeoCode((String) map.get("geoCode"));
        if (map.containsKey("schemeRule") && map.get("schemeRule") != null) p.setSchemeRule((String) map.get("schemeRule"));
        if (map.containsKey("schemeDuration") && map.get("schemeDuration") != null) p.setSchemeDuration((String) map.get("schemeDuration"));

        // Global Business Rule: New plazas default to Draft
        String status = (String) map.get("status");
        p.setStatus(status != null && !status.trim().isEmpty() ? status : "Draft");

        if (map.containsKey("publicKey") && map.get("publicKey") != null) p.setPublicKey((String) map.get("publicKey"));
        if (map.containsKey("contactAddress") && map.get("contactAddress") != null) p.setContactAddress(((String) map.get("contactAddress")).trim().toUpperCase());
        if (map.containsKey("contactNo") && map.get("contactNo") != null) p.setContactNo(((String) map.get("contactNo")).trim());
        if (map.containsKey("contactMail") && map.get("contactMail") != null) p.setContactMail(((String) map.get("contactMail")).trim());

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
