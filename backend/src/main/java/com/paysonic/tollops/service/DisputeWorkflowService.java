package com.paysonic.tollops.service;

import com.paysonic.tollops.entity.DisputeBatch;
import com.paysonic.tollops.entity.DisputeTransaction;
import com.paysonic.tollops.repository.DisputeBatchRepository;
import com.paysonic.tollops.repository.DisputeTransactionRepository;
import jakarta.persistence.criteria.Predicate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
public class DisputeWorkflowService {

    private static final Logger log = LoggerFactory.getLogger(DisputeWorkflowService.class);

    private static final DateTimeFormatter IST_DATETIME_FMT = DateTimeFormatter.ofPattern("dd-MM-yyyy HH:mm:ss");
    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("dd-MM-yyyy");

    private final DisputeTransactionRepository transactionRepository;
    private final DisputeBatchRepository batchRepository;

    public DisputeWorkflowService(DisputeTransactionRepository transactionRepository,
                                  DisputeBatchRepository batchRepository) {
        this.transactionRepository = transactionRepository;
        this.batchRepository = batchRepository;
    }

    /**
     * Upload and persist matched CSV rows into Railway MySQL
     */
    @Transactional
    public Map<String, Object> uploadBatch(Map<String, Object> payload) {
        String batchId = (String) payload.getOrDefault("batchId", "BATCH-" + System.currentTimeMillis());
        String fileName = (String) payload.getOrDefault("fileName", "disputes.csv");
        String uploadedBy = (String) payload.getOrDefault("uploadedBy", "Master Admin");

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> rows = (List<Map<String, Object>>) payload.get("rows");
        if (rows == null) {
            rows = Collections.emptyList();
        }

        List<DisputeTransaction> toInsert = new ArrayList<>();
        int duplicateCount = 0;
        int insertedCount = 0;

        for (Map<String, Object> r : rows) {
            String rrn = String.valueOf(r.getOrDefault("rrn", r.getOrDefault("acqTxnId", ""))).trim();
            if (rrn.isEmpty()) {
                continue;
            }

            // NPCI rule: Only one active open dispute allowed per transaction
            boolean hasOpen = transactionRepository.existsByAcqTxnIdAndClosedFalse(rrn);
            if (hasOpen) {
                duplicateCount++;
                continue;
            }

            DisputeTransaction dt = new DisputeTransaction();
            String dispId = String.valueOf(r.getOrDefault("disputeId", r.getOrDefault("rowId", "DISP-" + (1000 + toInsert.size() + (int)(Math.random() * 9000)))));
            dt.setDisputeId(dispId);
            dt.setBatchId(batchId);
            dt.setAcqTxnId(rrn);
            dt.setTollTxnId(String.valueOf(r.getOrDefault("tollTxnId", "—")));
            dt.setLaneId(String.valueOf(r.getOrDefault("laneId", "Lane-01")));
            dt.setPlazaId(String.valueOf(r.getOrDefault("plazaId", "501101")));
            dt.setPlazaName(String.valueOf(r.getOrDefault("plazaName", "MUMBAI PLAZA NH-04")));
            dt.setVehicleNo(String.valueOf(r.getOrDefault("vrn", r.getOrDefault("vehicleNo", "—"))));
            dt.setTagId(String.valueOf(r.getOrDefault("tagId", "—")));
            dt.setTid(String.valueOf(r.getOrDefault("tid", "TID-88401")));
            dt.setFunctionCode(String.valueOf(r.getOrDefault("functionCode", "450")));
            dt.setFunctionLabel(String.valueOf(r.getOrDefault("disputeType", r.getOrDefault("functionLabel", "Debit Chargeback Raised"))));
            dt.setMemberMessageText(String.valueOf(r.getOrDefault("memberMessageText", "Imported from file")));
            dt.setSettlementDate(String.valueOf(r.getOrDefault("settlementDate", "")));
            dt.setTatDueDate(String.valueOf(r.getOrDefault("tatDueDate", "")));
            dt.setCbRaisedDate(String.valueOf(r.getOrDefault("cbRaisedDate", r.getOrDefault("settlementDate", ""))));

            Object amtObj = r.get("txnAmount");
            if (amtObj != null) {
                dt.setTxnAmount(new BigDecimal(String.valueOf(amtObj)));
                dt.setDisputeAmount(new BigDecimal(String.valueOf(amtObj)));
            } else {
                dt.setTxnAmount(BigDecimal.ZERO);
                dt.setDisputeAmount(BigDecimal.ZERO);
            }

            dt.setTxnDateTime(LocalDateTime.now().minusDays(2));
            dt.setSettlementIndicator("Dr");
            dt.setAssigned(false);
            dt.setDisputeStatus("NA");
            dt.setLifecycleStatus("Pending Assignment");
            dt.setClosed(false);

            toInsert.add(dt);
            insertedCount++;
        }

        if (!toInsert.isEmpty()) {
            transactionRepository.saveAll(toInsert);
        }

        int totalInFile = ((Number) payload.getOrDefault("totalRows", rows.size())).intValue();
        int unmatchedInFile = ((Number) payload.getOrDefault("unmatchedRows", 0)).intValue();

        DisputeBatch batch = new DisputeBatch(
                batchId,
                fileName,
                uploadedBy,
                LocalDateTime.now(),
                totalInFile,
                insertedCount,
                unmatchedInFile,
                duplicateCount,
                "Processed"
        );
        batchRepository.save(batch);

        Map<String, Object> result = new HashMap<>();
        result.put("batchId", batchId);
        result.put("fileName", fileName);
        result.put("totalRows", totalInFile);
        result.put("insertedCount", insertedCount);
        result.put("duplicateCount", duplicateCount);
        result.put("unmatchedCount", unmatchedInFile);
        result.put("status", "Processed");
        return result;
    }

    /**
     * Get all uploaded batches
     */
    public List<DisputeBatch> getBatches() {
        return batchRepository.findAllByOrderByUploadTimestampDesc();
    }

    /**
     * Search dispute working queue with all lifecycle filters
     */
    public List<DisputeTransaction> searchDisputes(Map<String, String> filters) {
        Specification<DisputeTransaction> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            String functionCode = filters.get("functionCode");
            if (functionCode != null && !functionCode.trim().isEmpty() && !functionCode.equalsIgnoreCase("ALL")) {
                predicates.add(cb.equal(root.get("functionCode"), functionCode.trim()));
            }

            String plazaId = filters.get("plazaId");
            if (plazaId != null && !plazaId.trim().isEmpty() && !plazaId.equalsIgnoreCase("ALL")) {
                predicates.add(cb.or(
                        cb.equal(root.get("plazaId"), plazaId.trim()),
                        cb.equal(root.get("assignedToPlaza"), plazaId.trim())
                ));
            }

            String assignStatus = filters.get("assignStatus");
            if ("Assigned".equalsIgnoreCase(assignStatus)) {
                predicates.add(cb.isTrue(root.get("assigned")));
            } else if ("Unassigned".equalsIgnoreCase(assignStatus)) {
                predicates.add(cb.isFalse(root.get("assigned")));
            }

            String disputeStatus = filters.get("disputeStatus");
            if (disputeStatus != null && !disputeStatus.trim().isEmpty() && !disputeStatus.equalsIgnoreCase("ALL")) {
                if ("Pending".equalsIgnoreCase(disputeStatus)) {
                    predicates.add(cb.equal(root.get("disputeStatus"), "NA"));
                } else {
                    predicates.add(cb.equal(root.get("disputeStatus"), disputeStatus.trim()));
                }
            }

            String plazaAction = filters.get("plazaAction");
            if (plazaAction != null && !plazaAction.trim().isEmpty() && !plazaAction.equalsIgnoreCase("ALL")) {
                if ("Yes".equalsIgnoreCase(plazaAction) || "1".equals(plazaAction)) {
                    predicates.add(cb.isNotNull(root.get("plazaAction")));
                } else if ("No".equalsIgnoreCase(plazaAction) || "0".equals(plazaAction)) {
                    predicates.add(cb.isNull(root.get("plazaAction")));
                }
            }

            String search = filters.get("search");
            if (search != null && !search.trim().isEmpty()) {
                String pattern = "%" + search.trim().toLowerCase() + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("acqTxnId")), pattern),
                        cb.like(cb.lower(root.get("tollTxnId")), pattern),
                        cb.like(cb.lower(root.get("vehicleNo")), pattern),
                        cb.like(cb.lower(root.get("tagId")), pattern),
                        cb.like(cb.lower(root.get("disputeId")), pattern)
                ));
            }

            query.orderBy(cb.desc(root.get("createdAt")));
            return cb.and(predicates.toArray(new Predicate[0]));
        };

        return transactionRepository.findAll(spec);
    }

    /**
     * Admin mini-dashboard stats (Section 6.1)
     */
    public Map<String, Object> getAdminMiniStats() {
        List<DisputeTransaction> all = transactionRepository.findAll();

        long unassigned = all.stream().filter(d -> !Boolean.TRUE.equals(d.getAssigned()) && !Boolean.TRUE.equals(d.getClosed())).count();
        long assigned = all.stream().filter(d -> Boolean.TRUE.equals(d.getAssigned()) && !Boolean.TRUE.equals(d.getClosed())).count();

        LocalDate today = LocalDate.now();
        long plazaRevertsToday = all.stream().filter(d -> {
            if (d.getPlazaActionAt() == null) return false;
            return d.getPlazaActionAt().toLocalDate().isEqual(today);
        }).count();

        long approachingTat = all.stream().filter(d -> {
            if (Boolean.TRUE.equals(d.getClosed()) || !"NA".equals(d.getDisputeStatus())) return false;
            return computeDaysLeft(d.getTatDueDate()) <= 2;
        }).count();

        BigDecimal totalDisputeValue = all.stream()
                .filter(d -> !Boolean.TRUE.equals(d.getClosed()))
                .map(DisputeTransaction::getDisputeAmount)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        Map<String, Object> stats = new HashMap<>();
        stats.put("unassigned", unassigned);
        stats.put("assigned", assigned);
        stats.put("plazaRevertsToday", plazaRevertsToday);
        stats.put("approachingTat", approachingTat);
        stats.put("totalDisputeValue", totalDisputeValue);
        return stats;
    }

    /**
     * Plaza dispute dashboard statistics (Section 12)
     */
    public Map<String, Object> getPlazaStats(String plazaId) {
        List<DisputeTransaction> all = transactionRepository.findAll();
        List<DisputeTransaction> scoped = (plazaId != null && !plazaId.equalsIgnoreCase("ALL"))
                ? all.stream().filter(d -> plazaId.equals(d.getPlazaId()) || plazaId.equals(d.getAssignedToPlaza())).toList()
                : all;

        long total = scoped.size();
        long open = scoped.stream().filter(d -> "NA".equals(d.getDisputeStatus()) && !Boolean.TRUE.equals(d.getClosed())).count();
        long approved = scoped.stream().filter(d -> "Approved".equalsIgnoreCase(d.getDisputeStatus())).count();
        long rejected = scoped.stream().filter(d -> "Rejected".equalsIgnoreCase(d.getDisputeStatus())).count();
        long closed = scoped.stream().filter(d -> Boolean.TRUE.equals(d.getClosed())).count();

        BigDecimal acceptedAmount = scoped.stream()
                .filter(d -> "Approved".equalsIgnoreCase(d.getDisputeStatus()))
                .map(DisputeTransaction::getDisputeAmount)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal rejectedAmount = scoped.stream()
                .filter(d -> "Rejected".equalsIgnoreCase(d.getDisputeStatus()))
                .map(DisputeTransaction::getDisputeAmount)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        long withinTat = scoped.stream().filter(d -> "NA".equals(d.getDisputeStatus()) && computeDaysLeft(d.getTatDueDate()) >= 0).count();
        long breachedTat = scoped.stream().filter(d -> "NA".equals(d.getDisputeStatus()) && computeDaysLeft(d.getTatDueDate()) < 0).count();

        Map<String, Object> stats = new HashMap<>();
        stats.put("totalDisputes", total);
        stats.put("openDisputes", open);
        stats.put("approvedDisputes", approved);
        stats.put("rejectedDisputes", rejected);
        stats.put("closedDisputes", closed);
        stats.put("acceptedAmount", acceptedAmount);
        stats.put("rejectedAmount", rejectedAmount);
        stats.put("withinTat", withinTat);
        stats.put("breachedTat", breachedTat);
        return stats;
    }

    /**
     * Assign a single dispute to a plaza
     */
    @Transactional
    public DisputeTransaction assignDispute(String disputeId, String plazaId, String plazaName, String adminRemarks, String actor) {
        DisputeTransaction dt = transactionRepository.findByDisputeId(disputeId)
                .orElseThrow(() -> new IllegalArgumentException("Dispute ID not found: " + disputeId));

        if (Boolean.TRUE.equals(dt.getClosed())) {
            throw new IllegalStateException("Cannot assign closed dispute: " + disputeId);
        }
        if (adminRemarks == null || adminRemarks.trim().isEmpty()) {
            throw new IllegalArgumentException("Admin remarks are mandatory for assignment");
        }

        dt.setAssigned(true);
        dt.setAssignedToPlaza(plazaId);
        dt.setPlazaId(plazaId);
        if (plazaName != null && !plazaName.trim().isEmpty()) {
            dt.setPlazaName(plazaName);
        }
        dt.setAdminRemarks(adminRemarks.trim());
        dt.setAdminRemarksAt(LocalDateTime.now());
        dt.setLifecycleStatus("Assigned to Plaza");

        return transactionRepository.save(dt);
    }

    /**
     * Bulk assign disputes
     */
    @Transactional
    public int bulkAssign(List<String> disputeIds, String plazaId, String plazaName, String adminRemarks, String actor) {
        if (adminRemarks == null || adminRemarks.trim().isEmpty()) {
            throw new IllegalArgumentException("Admin remarks are mandatory for bulk assignment");
        }

        int count = 0;
        for (String id : disputeIds) {
            Optional<DisputeTransaction> opt = transactionRepository.findByDisputeId(id);
            if (opt.isPresent()) {
                DisputeTransaction dt = opt.get();
                if (!Boolean.TRUE.equals(dt.getClosed())) {
                    dt.setAssigned(true);
                    dt.setAssignedToPlaza(plazaId);
                    dt.setPlazaId(plazaId);
                    if (plazaName != null && !plazaName.trim().isEmpty()) {
                        dt.setPlazaName(plazaName);
                    }
                    dt.setAdminRemarks(adminRemarks.trim());
                    dt.setAdminRemarksAt(LocalDateTime.now());
                    dt.setLifecycleStatus("Assigned to Plaza");
                    transactionRepository.save(dt);
                    count++;
                }
            }
        }
        return count;
    }

    /**
     * Submit Plaza Decision (Accept or Reject)
     */
    @Transactional
    public DisputeTransaction submitDecision(String disputeId, String decision, String plazaRemarks,
                                              String counterEvidenceName, String counterEvidenceUrl,
                                              String actor, String actorPlazaId, boolean isMasterAdmin) {
        DisputeTransaction dt = transactionRepository.findByDisputeId(disputeId)
                .orElseThrow(() -> new IllegalArgumentException("Dispute ID not found: " + disputeId));

        // Server-side authorization check: plaza user must match assigned plaza
        if (!isMasterAdmin && actorPlazaId != null && !actorPlazaId.trim().isEmpty()) {
            String assignedPlaza = dt.getAssignedToPlaza() != null ? dt.getAssignedToPlaza() : dt.getPlazaId();
            if (!actorPlazaId.trim().equals(assignedPlaza)) {
                throw new SecurityException("Forbidden: You are not authorized to decide for Plaza " + assignedPlaza);
            }
        }

        // Prevent double-decision
        if (dt.getPlazaAction() != null && !dt.getPlazaAction().trim().isEmpty()) {
            throw new IllegalStateException("Dispute has already been actioned (" + dt.getPlazaAction() + "). Double-action prevented.");
        }

        // Validate mandatory plaza remarks
        if (plazaRemarks == null || plazaRemarks.trim().isEmpty()) {
            throw new IllegalArgumentException("Plaza remarks are mandatory to submit a decision.");
        }

        boolean isReject = "Reject".equalsIgnoreCase(decision) || "Rejected".equalsIgnoreCase(decision);
        if (isReject) {
            boolean hasEvidence = (counterEvidenceName != null && !counterEvidenceName.trim().isEmpty()) ||
                    (counterEvidenceUrl != null && !counterEvidenceUrl.trim().isEmpty());
            if (!hasEvidence) {
                throw new IllegalArgumentException("Counter-evidence is mandatory when rejecting a dispute.");
            }
        }

        LocalDateTime now = LocalDateTime.now();
        String istStr = now.format(IST_DATETIME_FMT);

        dt.setPlazaAction(isReject ? "Rejected" : "Accepted");
        dt.setPlazaActionAt(now);
        dt.setPlazaActionTime(istStr);
        dt.setPlazaActionBy(actor != null ? actor : "Plaza Operator");
        dt.setPlazaRemarks(plazaRemarks.trim());
        dt.setCounterEvidenceName(counterEvidenceName);
        dt.setCounterEvidenceUrl(counterEvidenceUrl);
        dt.setDisputeStatus(isReject ? "Rejected" : "Approved");
        dt.setLifecycleStatus(isReject ? "Plaza Rejected" : "Plaza Accepted");

        return transactionRepository.save(dt);
    }

    /**
     * Close dispute
     */
    @Transactional
    public DisputeTransaction closeDispute(String disputeId, String closeRemarks, String actor) {
        DisputeTransaction dt = transactionRepository.findByDisputeId(disputeId)
                .orElseThrow(() -> new IllegalArgumentException("Dispute ID not found: " + disputeId));

        dt.setClosed(true);
        dt.setClosedAt(LocalDateTime.now());
        dt.setClosedBy(actor != null ? actor : "Master Admin");
        dt.setCloseRemarks(closeRemarks);
        dt.setLifecycleStatus("Closed");

        return transactionRepository.save(dt);
    }

    /**
     * Clear all dispute transactions and batches for fresh start
     */
    @Transactional
    public Map<String, Object> clearAll() {
        long txnDeleted = transactionRepository.count();
        long batchDeleted = batchRepository.count();
        transactionRepository.deleteAll();
        batchRepository.deleteAll();
        log.info("Cleared {} dispute transactions and {} batches.", txnDeleted, batchDeleted);
        return Map.of("transactionsCleared", txnDeleted, "batchesCleared", batchDeleted);
    }

    private int computeDaysLeft(String tatDueDateStr) {
        if (tatDueDateStr == null || tatDueDateStr.trim().isEmpty()) return 7;
        try {
            LocalDate due = LocalDate.parse(tatDueDateStr.trim(), DATE_FMT);
            LocalDate now = LocalDate.now();
            return (int) java.time.temporal.ChronoUnit.DAYS.between(now, due);
        } catch (Exception e) {
            return 7;
        }
    }
}
