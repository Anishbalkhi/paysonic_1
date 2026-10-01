package com.paysonic.tollops.repository;

import com.paysonic.tollops.entity.ViolationValidateRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ViolationValidateRepository extends JpaRepository<ViolationValidateRecord, Long>, JpaSpecificationExecutor<ViolationValidateRecord> {
    Optional<ViolationValidateRecord> findByTollTxnId(String tollTxnId);
}
