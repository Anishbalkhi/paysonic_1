package com.paysonic.tollops.repository;

import com.paysonic.tollops.entity.TollTransaction;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface TollTransactionRepository extends JpaRepository<TollTransaction, Long>, JpaSpecificationExecutor<TollTransaction> {

    Optional<TollTransaction> findByAcqTxnId(String acqTxnId);

    long countByTxnDateBetween(LocalDateTime from, LocalDateTime to);

    long countByPlazaId(String plazaId);

    Page<TollTransaction> findByTxnDateBetween(LocalDateTime from, LocalDateTime to, Pageable pageable);

    List<TollTransaction> findByTxnDateBetweenOrderByTxnDateDesc(LocalDateTime from, LocalDateTime to);
}
