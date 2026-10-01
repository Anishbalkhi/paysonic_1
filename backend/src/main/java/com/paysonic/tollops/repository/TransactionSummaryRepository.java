package com.paysonic.tollops.repository;

import com.paysonic.tollops.entity.TransactionSummaryRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface TransactionSummaryRepository extends JpaRepository<TransactionSummaryRecord, Long>, JpaSpecificationExecutor<TransactionSummaryRecord> {

    List<TransactionSummaryRecord> findByPlazaIdAndReportDateBetweenOrderByDisplayOrderAsc(
            String plazaId, LocalDate startDate, LocalDate endDate
    );

    List<TransactionSummaryRecord> findByReportDateBetweenOrderByDisplayOrderAsc(
            LocalDate startDate, LocalDate endDate
    );
}
