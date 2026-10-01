package com.paysonic.tollops.repository;

import com.paysonic.tollops.entity.NhaiTrafficRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface NhaiTrafficRepository extends JpaRepository<NhaiTrafficRecord, Long>, JpaSpecificationExecutor<NhaiTrafficRecord> {

    List<NhaiTrafficRecord> findByPlazaCodeAndReportDateBetweenOrderByDisplayOrderAsc(
            String plazaCode, LocalDate startDate, LocalDate endDate
    );

    List<NhaiTrafficRecord> findByReportDateBetweenOrderByDisplayOrderAsc(
            LocalDate startDate, LocalDate endDate
    );
}
