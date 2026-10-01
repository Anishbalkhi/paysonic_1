package com.paysonic.tollops.repository;

import com.paysonic.tollops.entity.PassSummaryRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface PassSummaryRepository extends JpaRepository<PassSummaryRecord, Long> {

    @Query("SELECT p FROM PassSummaryRecord p " +
           "WHERE (:plazaId IS NULL OR :plazaId = 'ALL' OR p.plazaId = :plazaId) " +
           "AND p.reportDate BETWEEN :fromDate AND :toDate " +
           "ORDER BY p.plazaId, p.paymentMode, p.displayOrder")
    List<PassSummaryRecord> findByFilters(
            @Param("plazaId") String plazaId,
            @Param("fromDate") LocalDate fromDate,
            @Param("toDate") LocalDate toDate);

    boolean existsByReportDate(LocalDate reportDate);
}
