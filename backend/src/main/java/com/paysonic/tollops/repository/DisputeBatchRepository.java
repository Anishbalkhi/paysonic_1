package com.paysonic.tollops.repository;

import com.paysonic.tollops.entity.DisputeBatch;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DisputeBatchRepository extends JpaRepository<DisputeBatch, Long> {
    Optional<DisputeBatch> findByBatchId(String batchId);
    List<DisputeBatch> findAllByOrderByUploadTimestampDesc();
}
