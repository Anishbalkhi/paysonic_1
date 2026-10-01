package com.paysonic.tollops.repository;

import com.paysonic.tollops.entity.ViolationRawRecord;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface ViolationRawRecordRepository extends JpaRepository<ViolationRawRecord, Long>, JpaSpecificationExecutor<ViolationRawRecord> {

    Optional<ViolationRawRecord> findByTxnId(String txnId);

    long countByParsedDateTimeBetween(LocalDateTime from, LocalDateTime to);

    Page<ViolationRawRecord> findByParsedDateTimeBetween(LocalDateTime from, LocalDateTime to, Pageable pageable);

    List<ViolationRawRecord> findByParsedDateTimeBetweenOrderByParsedDateTimeDesc(LocalDateTime from, LocalDateTime to);
}
