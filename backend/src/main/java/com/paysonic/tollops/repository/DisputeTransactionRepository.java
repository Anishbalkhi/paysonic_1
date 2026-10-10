package com.paysonic.tollops.repository;

import com.paysonic.tollops.entity.DisputeTransaction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DisputeTransactionRepository extends JpaRepository<DisputeTransaction, Long>, JpaSpecificationExecutor<DisputeTransaction> {
    long countByPlazaId(String plazaId);
    Optional<DisputeTransaction> findByDisputeId(String disputeId);
    Optional<DisputeTransaction> findByAcqTxnIdAndClosedFalse(String acqTxnId);
    boolean existsByAcqTxnIdAndClosedFalse(String acqTxnId);
    List<DisputeTransaction> findByAcqTxnId(String acqTxnId);
    List<DisputeTransaction> findByBatchId(String batchId);
}
