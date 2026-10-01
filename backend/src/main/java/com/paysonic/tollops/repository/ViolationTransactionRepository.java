package com.paysonic.tollops.repository;

import com.paysonic.tollops.entity.ViolationTransaction;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface ViolationTransactionRepository extends JpaRepository<ViolationTransaction, Long>, JpaSpecificationExecutor<ViolationTransaction> {

    Optional<ViolationTransaction> findByTollTxnId(String tollTxnId);

    long countByTxnDateTimeBetween(LocalDateTime from, LocalDateTime to);

    Page<ViolationTransaction> findByTxnDateTimeBetween(LocalDateTime from, LocalDateTime to, Pageable pageable);

    List<ViolationTransaction> findByTxnDateTimeBetweenOrderByTxnDateTimeDesc(LocalDateTime from, LocalDateTime to);
}
