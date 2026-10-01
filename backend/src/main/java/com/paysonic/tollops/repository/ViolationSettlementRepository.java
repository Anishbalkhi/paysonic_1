package com.paysonic.tollops.repository;

import com.paysonic.tollops.entity.ViolationSettlementRecord;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface ViolationSettlementRepository extends JpaRepository<ViolationSettlementRecord, Long>, JpaSpecificationExecutor<ViolationSettlementRecord> {

    long countByTxnDateTimeBetween(LocalDateTime from, LocalDateTime to);

    Page<ViolationSettlementRecord> findByTxnDateTimeBetween(LocalDateTime from, LocalDateTime to, Pageable pageable);

    List<ViolationSettlementRecord> findByTxnDateTimeBetweenOrderByTxnDateTimeDesc(LocalDateTime from, LocalDateTime to);
}
