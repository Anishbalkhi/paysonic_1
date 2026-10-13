package com.paysonic.tollops.service;

import com.paysonic.tollops.entity.DisputeBatch;
import com.paysonic.tollops.entity.DisputeTransaction;
import com.paysonic.tollops.entity.TollTransaction;
import com.paysonic.tollops.repository.DisputeBatchRepository;
import com.paysonic.tollops.repository.DisputeTransactionRepository;
import com.paysonic.tollops.repository.TollTransactionRepository;
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

    public static final Set<String> ALLOWED_FUNCTION_CODES = Set.of(
            "450", "451", "471", "479", "481", "680"
    );

    public static final Map<String, String> FUNCTION_CODE_MAP = Map.of(
            "450", "Debit Chargeback Raised",
            "451", "Credit Chargeback Raised",
            "471", "Pre-Arbitration Raised",
            "479", "Arbitration Raised",
            "481", "Arbitration Continuation",
            "680", "Good Faith Raised"
    );

    private final DisputeTransactionRepository transactionRepository;
    private final DisputeBatchRepository batchRepository;
    private final TollTransactionRepository tollTransactionRepository;

    public DisputeWorkflowService(DisputeTransactionRepository transactionRepository,
                                  DisputeBatchRepository batchRepository,
                                  TollTransactionRepository tollTransactionRepository) {
        this.transactionRepository = transactionRepository;
        this.batchRepository = batchRepository;
        this.tollTransactionRepository = tollTransactionRepository;
    }

    /**
     * Validate and match uploaded CSV rows against the Single Master Transaction Table (toll_transactions)
     * Rules:
     * 1. Match RRN with ACQ TXN ID in toll_transactions
     * 2. Allowed Function Codes strictly: 450, 451, 471, 479, 481, 680
     * 3. Duplicate check: Same RRN AND Same Function Code in active queue
     * 4. Disputed Amount: from CSV file
     * 5. Txn Amount, Plaza ID, Plaza Name, Txn Date: from toll_transactions
     */
    public Map<String, Object> validateAndMatchCsv(List<Map<String, Object>> rows) {
        if (rows == null) rows = Collections.emptyList();

        List<Map<String, Object>> results = new ArrayList<>();
        List<Map<String, Object>> errorRows = new ArrayList<>();
        int matchedCount = 0;
        int mismatchedCount = 0;
        int duplicateCount = 0;
        int invalidCodeCount = 0;

        for (int idx = 0; idx < rows.size(); idx++) {
            Map<String, Object> row = rows.get(idx);
            int rowNumber = idx + 2; // header offset

            String rrn = extractKey(row, "rrn", "RRN", "acqTxnId", "Acq Txn ID", "acq_txn_id", "Acquirer Reference Number");
            if (rrn == null || rrn.trim().isEmpty()) {
                errorRows.add(Map.of(
                        "rowNumber", rowNumber,
                        "rrn", "EMPTY",
                        "functionCode", "—",
                        "disputeAmount", "0.00",
                        "reason", "Missing RRN / Acq Txn ID"
                ));
                mismatchedCount++;
                continue;
            }
            rrn = rrn.trim();

            String rawFuncCode = extractKey(row, "functionCode", "Function Code", "FunctionCode", "function_code");
            String functionCode = (rawFuncCode != null && !rawFuncCode.trim().isEmpty()) ? rawFuncCode.trim() : "450";

            BigDecimal disputeAmount = parseDisputeAmount(row);

            // Rule 3.4.b: Whitelist Check
            if (!ALLOWED_FUNCTION_CODES.contains(functionCode)) {
                errorRows.add(Map.of(
                        "rowNumber", rowNumber,
                        "rrn", rrn,
                        "functionCode", functionCode,
                        "disputeAmount", disputeAmount != null ? disputeAmount.toString() : "0.00",
                        "reason", "Invalid Function Code '" + functionCode + "'. Allowed codes: 450, 451, 471, 479, 481, 680."
                ));
                invalidCodeCount++;
                continue;
            }

            // Rule 3.1: Match RRN with ACQ TXN ID in toll_transactions
            Optional<TollTransaction> optToll = tollTransactionRepository.findByAcqTxnId(rrn);
            if (optToll.isEmpty()) {
                errorRows.add(Map.of(
                        "rowNumber", rowNumber,
                        "rrn", rrn,
                        "functionCode", functionCode,
                        "disputeAmount", disputeAmount != null ? disputeAmount.toString() : "0.00",
                        "reason", "Mismatched: RRN '" + rrn + "' not found in Master Transaction Table"
                ));
                mismatchedCount++;
                continue;
            }

            TollTransaction toll = optToll.get();
            if (disputeAmount == null) {
                disputeAmount = toll.getTxnAmount();
            }

            // Rule 3.4.a: Duplicate Check (Same RRN AND Same Function Code in active queue)
            boolean isDuplicate = transactionRepository.existsByAcqTxnIdAndFunctionCodeAndClosedFalse(rrn, functionCode);
            if (isDuplicate) {
                errorRows.add(Map.of(
                        "rowNumber", rowNumber,
                        "rrn", rrn,
                        "functionCode", functionCode,
                        "disputeAmount", disputeAmount.toString(),
                        "reason", "Duplicate row: Transaction RRN '" + rrn + "' with Function Code " + functionCode + " already has an active open dispute in queue"
                ));
                duplicateCount++;
                continue;
            }

            // Hydrate Matched Record
            String rawSettlement = extractKey(row, "settlementDate", "Settlement Date", "Settlement_Date", "settlement_date");
            String settlementDate = (rawSettlement != null && !rawSettlement.trim().isEmpty()) ? rawSettlement.trim() : LocalDate.now().format(DATE_FMT);
            String tatDueDate = computeTatDueDate(settlementDate);
            String memberMsg = extractMemberMessage(row);

            Map<String, Object> matched = new LinkedHashMap<>();
            matched.put("rowNumber", rowNumber);
            matched.put("status", "Matched");
            matched.put("isMatched", true);
            matched.put("rrn", rrn);
            matched.put("acqTxnId", rrn);
            matched.put("tollTxnId", toll.getTollTxnId() != null ? toll.getTollTxnId() : "—");
            matched.put("laneId", toll.getLaneId() != null ? toll.getLaneId() : "Lane-01");
            matched.put("plazaId", toll.getPlazaId());
            matched.put("plazaName", toll.getPlazaName());
            matched.put("vrn", toll.getVrn() != null ? toll.getVrn() : "—");
            matched.put("tagId", toll.getTagId() != null ? toll.getTagId() : "—");
            matched.put("txnDate", toll.getTxnDate() != null ? toll.getTxnDate().format(IST_DATETIME_FMT) : "—");
            matched.put("txnDateTime", toll.getTxnDate());
            matched.put("txnAmount", toll.getTxnAmount()); // Authoritative Transaction Amount from DB
            matched.put("disputeAmount", disputeAmount);   // Disputed Amount from CSV
            matched.put("functionCode", functionCode);
            matched.put("disputeType", FUNCTION_CODE_MAP.getOrDefault(functionCode, "Code " + functionCode));
            matched.put("settlementDate", settlementDate);
            matched.put("tatDueDate", tatDueDate);
            matched.put("cbRaisedDate", settlementDate);
            matched.put("memberMessageText", memberMsg);
            matched.put("cbReason", memberMsg);

            results.add(matched);
            matchedCount++;
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("totalRows", rows.size());
        response.put("matchedCount", matchedCount);
        response.put("mismatchedCount", mismatchedCount);
        response.put("duplicateCount", duplicateCount);
        response.put("invalidCodeCount", invalidCodeCount);
        response.put("results", results);
        response.put("errorRows", errorRows);
        return response;
    }

    /**
     * Upload and persist matched CSV rows into MySQL
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
        int mismatchedCount = 0;

        for (Map<String, Object> r : rows) {
            String rrn = extractKey(r, "rrn", "RRN", "acqTxnId", "Acq Txn ID", "acq_txn_id");
            if (rrn == null || rrn.trim().isEmpty()) {
                mismatchedCount++;
                continue;
            }
            rrn = rrn.trim();

            String rawFuncCode = extractKey(r, "functionCode", "Function Code", "FunctionCode", "function_code");
            String functionCode = (rawFuncCode != null && !rawFuncCode.trim().isEmpty()) ? rawFuncCode.trim() : "450";
            if (!ALLOWED_FUNCTION_CODES.contains(functionCode)) {
                continue;
            }

            // Must match against Single Master Transaction Table
            Optional<TollTransaction> optToll = tollTransactionRepository.findByAcqTxnId(rrn);
            if (optToll.isEmpty()) {
                mismatchedCount++;
                continue; // Do NOT insert mismatched rows into Dispute Assign queue
            }
            TollTransaction toll = optToll.get();

            // Duplicate Rule: Same RRN AND Same Function Code in active queue
            boolean isDuplicate = transactionRepository.existsByAcqTxnIdAndFunctionCodeAndClosedFalse(rrn, functionCode);
            if (isDuplicate) {
                duplicateCount++;
                continue;
            }

            BigDecimal disputeAmount = parseDisputeAmount(r);
            if (disputeAmount == null) {
                disputeAmount = toll.getTxnAmount();
            }

            DisputeTransaction dt = new DisputeTransaction();
            String dispId = String.valueOf(r.getOrDefault("disputeId", r.getOrDefault("rowId", "DISP-" + (1000 + toInsert.size() + (int)(Math.random() * 9000)))));
            dt.setDisputeId(dispId);
            dt.setBatchId(batchId);
            dt.setAcqTxnId(rrn);
            dt.setTollTxnId(toll.getTollTxnId() != null ? toll.getTollTxnId() : "—");
            dt.setLaneId(toll.getLaneId() != null ? toll.getLaneId() : "Lane-01");
            dt.setPlazaId(toll.getPlazaId());
            dt.setPlazaName(toll.getPlazaName());
            dt.setVehicleNo(toll.getVrn() != null ? toll.getVrn() : "—");
            dt.setTagId(toll.getTagId() != null ? toll.getTagId() : "—");
            dt.setTid(String.valueOf(r.getOrDefault("tid", "TID-88401")));
            dt.setFunctionCode(functionCode);
            dt.setFunctionLabel(FUNCTION_CODE_MAP.getOrDefault(functionCode, "Code " + functionCode));

            String msgText = extractMemberMessage(r);
            dt.setMemberMessageText(msgText);
            dt.setAdminRemarks(msgText);

            String rawSettlement = extractKey(r, "settlementDate", "Settlement Date", "Settlement_Date", "settlement_date");
            String settlementDate = (rawSettlement != null && !rawSettlement.trim().isEmpty()) ? rawSettlement.trim() : LocalDate.now().format(DATE_FMT);
            dt.setSettlementDate(settlementDate);
            dt.setTatDueDate(computeTatDueDate(settlementDate));
            dt.setCbRaisedDate(settlementDate);

            // Hydrate amounts: Txn Amount from DB, Dispute Amount from CSV
            dt.setTxnAmount(toll.getTxnAmount());
            dt.setDisputeAmount(disputeAmount);

            dt.setTxnDateTime(toll.getTxnDate() != null ? toll.getTxnDate() : LocalDateTime.now().minusDays(2));
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
        int unmatchedInFile = ((Number) payload.getOrDefault("unmatchedRows", mismatchedCount)).intValue();

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

        List<DisputeTransaction> results = transactionRepository.findAll(spec);
        for (DisputeTransaction dt : results) {
            if (Boolean.TRUE.equals(dt.getAssigned()) && dt.getAssignedAt() == null) {
                dt.setAssignedAt(dt.getAdminRemarksAt() != null ? dt.getAdminRemarksAt() : (dt.getCreatedAt() != null ? dt.getCreatedAt() : LocalDateTime.now()));
            }
            if (dt.getAdminRemarks() == null || dt.getAdminRemarks().trim().isEmpty() || "Bulk-assigned for plaza review".equalsIgnoreCase(dt.getAdminRemarks().trim())) {
                if (dt.getMemberMessageText() != null && !dt.getMemberMessageText().trim().isEmpty() && !"Imported from file".equalsIgnoreCase(dt.getMemberMessageText())) {
                    dt.setAdminRemarks(dt.getMemberMessageText().trim());
                }
            }
        }
        return results;
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
            if (dt.getMemberMessageText() != null && !dt.getMemberMessageText().trim().isEmpty()) {
                adminRemarks = dt.getMemberMessageText().trim();
            }
        }
        if (adminRemarks == null || adminRemarks.trim().isEmpty()) {
            throw new IllegalArgumentException("Admin remarks are mandatory for assignment");
        }

        dt.setAssigned(true);
        dt.setAssignedAt(LocalDateTime.now());
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
                    String rowRemarks = (dt.getMemberMessageText() != null && !dt.getMemberMessageText().trim().isEmpty() && !"Imported from file".equalsIgnoreCase(dt.getMemberMessageText()))
                            ? dt.getMemberMessageText().trim()
                            : adminRemarks.trim();
                    dt.setAssigned(true);
                    dt.setAssignedAt(LocalDateTime.now());
                    dt.setAssignedToPlaza(plazaId);
                    dt.setPlazaId(plazaId);
                    if (plazaName != null && !plazaName.trim().isEmpty()) {
                        dt.setPlazaName(plazaName);
                    }
                    dt.setAdminRemarks(rowRemarks);
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
     * Unassign a dispute
     */
    @Transactional
    public DisputeTransaction unassignDispute(String disputeId, String actor) {
        DisputeTransaction dt = transactionRepository.findByDisputeId(disputeId)
                .orElseThrow(() -> new IllegalArgumentException("Dispute not found: " + disputeId));

        if ("Accepted".equalsIgnoreCase(dt.getPlazaAction()) || "Rejected".equalsIgnoreCase(dt.getPlazaAction()) ||
                "Approved".equalsIgnoreCase(dt.getDisputeStatus()) || "Rejected".equalsIgnoreCase(dt.getDisputeStatus())) {
            throw new IllegalStateException("Cannot unassign a dispute that has already been decided by the plaza.");
        }

        dt.setAssigned(false);
        dt.setAssignedAt(null);
        dt.setAssignedToPlaza(null);
        dt.setAdminRemarks(null);
        dt.setAdminRemarksAt(null);
        dt.setLifecycleStatus("Pending Assignment");
        return transactionRepository.save(dt);
    }

    /**
     * Bulk unassign disputes
     */
    @Transactional
    public int bulkUnassign(List<String> disputeIds, String actor) {
        int count = 0;
        for (String id : disputeIds) {
            Optional<DisputeTransaction> opt = transactionRepository.findByDisputeId(id);
            if (opt.isPresent()) {
                DisputeTransaction dt = opt.get();
                boolean isDecided = "Accepted".equalsIgnoreCase(dt.getPlazaAction()) || "Rejected".equalsIgnoreCase(dt.getPlazaAction()) ||
                        "Approved".equalsIgnoreCase(dt.getDisputeStatus()) || "Rejected".equalsIgnoreCase(dt.getDisputeStatus());
                if (!isDecided && !Boolean.TRUE.equals(dt.getClosed()) && Boolean.TRUE.equals(dt.getAssigned())) {
                    dt.setAssigned(false);
                    dt.setAssignedAt(null);
                    dt.setAssignedToPlaza(null);
                    dt.setAdminRemarks(null);
                    dt.setAdminRemarksAt(null);
                    dt.setLifecycleStatus("Pending Assignment");
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

        boolean isReject = "Reject".equalsIgnoreCase(decision) || "Rejected".equalsIgnoreCase(decision);
        if (isReject) {
            // Remarks is mandatory only when plaza is rejecting the dispute
            if (plazaRemarks == null || plazaRemarks.trim().isEmpty()) {
                throw new IllegalArgumentException("Plaza remarks are mandatory when rejecting a dispute.");
            }
            boolean hasEvidence = (counterEvidenceName != null && !counterEvidenceName.trim().isEmpty()) ||
                    (counterEvidenceUrl != null && !counterEvidenceUrl.trim().isEmpty());
            if (!hasEvidence) {
                throw new IllegalArgumentException("Counter-evidence is mandatory when rejecting a dispute.");
            }
        } else {
            // When accepting, remarks is optional
            if (plazaRemarks == null || plazaRemarks.trim().isEmpty()) {
                plazaRemarks = "Accepted";
            }
        }

        LocalDateTime now = LocalDateTime.now();
        String istStr = now.format(IST_DATETIME_FMT);

        if (dt.getAssignedAt() == null) {
            dt.setAssignedAt(dt.getAdminRemarksAt() != null ? dt.getAdminRemarksAt() : (dt.getCreatedAt() != null ? dt.getCreatedAt() : now));
        }

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

    private String extractKey(Map<String, Object> map, String... keys) {
        if (map == null) return null;
        for (String k : keys) {
            if (map.containsKey(k) && map.get(k) != null) {
                String val = String.valueOf(map.get(k)).trim();
                if (!val.isEmpty() && !"null".equalsIgnoreCase(val)) {
                    return val;
                }
            }
        }
        for (Map.Entry<String, Object> entry : map.entrySet()) {
            String cleanKey = entry.getKey().toLowerCase().replaceAll("[\\s_-]", "");
            for (String k : keys) {
                if (cleanKey.equals(k.toLowerCase().replaceAll("[\\s_-]", ""))) {
                    if (entry.getValue() != null) {
                        String val = String.valueOf(entry.getValue()).trim();
                        if (!val.isEmpty() && !"null".equalsIgnoreCase(val)) {
                            return val;
                        }
                    }
                }
            }
        }
        return null;
    }

    private BigDecimal parseDisputeAmount(Map<String, Object> row) {
        String raw = extractKey(row, "disputeAmount", "Dispute Amount", "Disputed Amount", "disputedAmount", "amount", "Amount", "Dispute Amt", "txnAmount", "Transaction Amount");
        if (raw != null && !raw.trim().isEmpty()) {
            try {
                return new BigDecimal(raw.trim().replace(",", ""));
            } catch (Exception ignored) {}
        }
        return null;
    }

    private String extractMemberMessage(Map<String, Object> r) {
        String msg = extractKey(r, "memberMessageText", "Member Message Text", "cbReason", "CB Reason", "reason", "Reason", "messageText");
        return (msg != null && !msg.isEmpty()) ? msg : "Imported from file";
    }

    private String computeTatDueDate(String settlementDateStr) {
        if (settlementDateStr == null || settlementDateStr.trim().isEmpty()) {
            return LocalDate.now().plusDays(8).format(DATE_FMT);
        }
        try {
            LocalDate dt = LocalDate.parse(settlementDateStr.trim(), DATE_FMT);
            return dt.plusDays(8).format(DATE_FMT);
        } catch (Exception e) {
            return LocalDate.now().plusDays(8).format(DATE_FMT);
        }
    }
}
