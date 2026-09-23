package com.paysonic.tollops.repository;

import com.paysonic.tollops.entity.AuditLog;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface AuditLogRepository extends JpaRepository<AuditLog, String>, JpaSpecificationExecutor<AuditLog> {
    List<AuditLog> findByModule(String module, Sort sort);
    List<AuditLog> findByStatus(String status, Sort sort);
    List<AuditLog> findByPlaza(String plaza, Sort sort);
    List<AuditLog> findByActorId(String actorId, Sort sort);

    @Query("SELECT COUNT(a) FROM AuditLog a WHERE a.status IN ('WARNING', 'FAILURE')")
    long countCriticalEvents();

    long countByAction(String action);

    @Query("SELECT COUNT(a) FROM AuditLog a WHERE a.timestamp >= :since")
    long countActivitiesSince(@Param("since") LocalDateTime since);

    @Query("SELECT a.module, COUNT(a) FROM AuditLog a GROUP BY a.module ORDER BY COUNT(a) DESC")
    List<Object[]> findModuleCounts();
}
