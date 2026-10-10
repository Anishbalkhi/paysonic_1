package com.paysonic.tollops.controller;

import com.paysonic.tollops.aspect.Auditable;
import com.paysonic.tollops.entity.DisputeBatch;
import com.paysonic.tollops.entity.DisputeTransaction;
import com.paysonic.tollops.service.DisputeWorkflowService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Collections;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/disputes/workflow")
@CrossOrigin(origins = "*")
public class DisputeWorkflowController {

    private static final Logger log = LoggerFactory.getLogger(DisputeWorkflowController.class);
    private final DisputeWorkflowService workflowService;

    public DisputeWorkflowController(DisputeWorkflowService workflowService) {
        this.workflowService = workflowService;
    }

    /**
     * Upload and stage CSV dispute rows into Railway MySQL
     */
    @PostMapping("/batches/upload")
    @Auditable(module = "Dispute Handling", action = "UPLOAD_DISPUTE_BATCH", actionLabel = "Uploaded Dispute CSV Batch", target = "Dispute File Upload")
    public ResponseEntity<?> uploadBatch(@RequestBody Map<String, Object> payload) {
        try {
            Map<String, Object> res = workflowService.uploadBatch(payload);
            return ResponseEntity.ok(res);
        } catch (Exception ex) {
            log.error("Error uploading dispute batch: {}", ex.getMessage(), ex);
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        }
    }

    /**
     * Get all uploaded batches for File Status page
     */
    @GetMapping("/batches")
    public ResponseEntity<List<DisputeBatch>> getBatches() {
        return ResponseEntity.ok(workflowService.getBatches());
    }

    /**
     * Search dispute queue for Chargeback Assign / Validate Dispute
     */
    @GetMapping("/queue")
    public ResponseEntity<List<DisputeTransaction>> searchQueue(@RequestParam Map<String, String> filters) {
        return ResponseEntity.ok(workflowService.searchDisputes(filters));
    }

    /**
     * Admin mini-dashboard metrics
     */
    @GetMapping("/stats/admin")
    public ResponseEntity<Map<String, Object>> getAdminStats() {
        return ResponseEntity.ok(workflowService.getAdminMiniStats());
    }

    /**
     * Plaza dashboard metrics
     */
    @GetMapping("/stats/plaza")
    public ResponseEntity<Map<String, Object>> getPlazaStats(@RequestParam(required = false, defaultValue = "ALL") String plazaId) {
        return ResponseEntity.ok(workflowService.getPlazaStats(plazaId));
    }

    /**
     * Assign a single dispute to a plaza
     */
    @PutMapping("/assign/{disputeId}")
    @Auditable(module = "Dispute Handling", action = "ASSIGN_DISPUTE", actionLabel = "Assigned Dispute to Plaza", target = "Chargeback Assign")
    public ResponseEntity<?> assignDispute(
            @PathVariable String disputeId,
            @RequestBody Map<String, String> body) {
        try {
            String plazaId = body.get("plazaId");
            String plazaName = body.get("plazaName");
            String adminRemarks = body.get("adminRemarks");
            String actor = body.getOrDefault("actor", "Master Admin");

            DisputeTransaction dt = workflowService.assignDispute(disputeId, plazaId, plazaName, adminRemarks, actor);
            return ResponseEntity.ok(dt);
        } catch (IllegalArgumentException | IllegalStateException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        } catch (Exception ex) {
            log.error("Error assigning dispute: {}", ex.getMessage(), ex);
            return ResponseEntity.internalServerError().body(Map.of("error", ex.getMessage()));
        }
    }

    /**
     * Bulk assign disputes
     */
    @PutMapping("/bulk-assign")
    @Auditable(module = "Dispute Handling", action = "BULK_ASSIGN_DISPUTES", actionLabel = "Bulk Assigned Disputes to Plaza", target = "Chargeback Assign")
    public ResponseEntity<?> bulkAssign(@RequestBody Map<String, Object> body) {
        try {
            @SuppressWarnings("unchecked")
            List<String> disputeIds = (List<String>) body.getOrDefault("disputeIds", Collections.emptyList());
            String plazaId = (String) body.get("plazaId");
            String plazaName = (String) body.get("plazaName");
            String adminRemarks = (String) body.get("adminRemarks");
            String actor = (String) body.getOrDefault("actor", "Master Admin");

            int count = workflowService.bulkAssign(disputeIds, plazaId, plazaName, adminRemarks, actor);
            return ResponseEntity.ok(Map.of("assignedCount", count, "message", "Bulk assigned " + count + " disputes."));
        } catch (IllegalArgumentException | IllegalStateException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        } catch (Exception ex) {
            log.error("Error bulk assigning disputes: {}", ex.getMessage(), ex);
            return ResponseEntity.internalServerError().body(Map.of("error", ex.getMessage()));
        }
    }

    /**
     * Submit Plaza Decision (Accept or Reject)
     */
    @PutMapping("/decision/{disputeId}")
    @Auditable(module = "Dispute Handling", action = "SUBMIT_PLAZA_DECISION", actionLabel = "Plaza Submitted Decision", target = "Validate Dispute")
    public ResponseEntity<?> submitDecision(
            @PathVariable String disputeId,
            @RequestBody Map<String, Object> body) {
        try {
            String decision = (String) body.get("decision");
            String plazaRemarks = (String) body.get("plazaRemarks");
            String counterEvidenceName = (String) body.get("counterEvidenceName");
            String counterEvidenceUrl = (String) body.get("counterEvidenceUrl");
            String actor = (String) body.getOrDefault("actor", "Plaza Operator");
            String actorPlazaId = (String) body.get("actorPlazaId");
            boolean isMasterAdmin = Boolean.TRUE.equals(body.get("isMasterAdmin"));

            DisputeTransaction dt = workflowService.submitDecision(
                    disputeId, decision, plazaRemarks, counterEvidenceName, counterEvidenceUrl,
                    actor, actorPlazaId, isMasterAdmin
            );
            return ResponseEntity.ok(dt);
        } catch (SecurityException ex) {
            return ResponseEntity.status(403).body(Map.of("error", ex.getMessage()));
        } catch (IllegalArgumentException | IllegalStateException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        } catch (Exception ex) {
            log.error("Error submitting decision: {}", ex.getMessage(), ex);
            return ResponseEntity.internalServerError().body(Map.of("error", ex.getMessage()));
        }
    }

    /**
     * Close a dispute
     */
    @PutMapping("/close/{disputeId}")
    @Auditable(module = "Dispute Handling", action = "CLOSE_DISPUTE", actionLabel = "Closed Dispute", target = "Dispute Management")
    public ResponseEntity<?> closeDispute(
            @PathVariable String disputeId,
            @RequestBody Map<String, String> body) {
        try {
            String closeRemarks = body.get("closeRemarks");
            String actor = body.getOrDefault("actor", "Master Admin");

            DisputeTransaction dt = workflowService.closeDispute(disputeId, closeRemarks, actor);
            return ResponseEntity.ok(dt);
        } catch (Exception ex) {
            log.error("Error closing dispute: {}", ex.getMessage(), ex);
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        }
    }

    /**
     * Clear all disputes from database for testing/fresh start
     */
    @DeleteMapping("/clear")
    @Auditable(module = "Dispute Handling", action = "CLEAR_ALL_DISPUTES", actionLabel = "Cleared All Dispute Data", target = "Dispute Management")
    public ResponseEntity<?> clearAll() {
        try {
            Map<String, Object> res = workflowService.clearAll();
            return ResponseEntity.ok(res);
        } catch (Exception ex) {
            log.error("Error clearing dispute records: {}", ex.getMessage(), ex);
            return ResponseEntity.internalServerError().body(Map.of("error", ex.getMessage()));
        }
    }
}
