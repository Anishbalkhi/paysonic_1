package com.paysonic.tollops.repository;

import com.paysonic.tollops.entity.DisputeTransaction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

@Repository
public interface DisputeTransactionRepository extends JpaRepository<DisputeTransaction, Long>, JpaSpecificationExecutor<DisputeTransaction> {
    long countByPlazaId(String plazaId);
}
