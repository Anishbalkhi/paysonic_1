package com.paysonic.tollops.repository;

import com.paysonic.tollops.entity.LoginHistory;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface LoginHistoryRepository extends JpaRepository<LoginHistory, Long> {
    List<LoginHistory> findByStatus(String status, Sort sort);
    List<LoginHistory> findByUserId(String userId, Sort sort);
    long countByStatus(String status);
    
    @Query("SELECT COUNT(l) FROM LoginHistory l WHERE l.status = 'Failed' AND l.timestamp >= :since")
    long countFailedSince(@Param("since") LocalDateTime since);

    @Query("SELECT COUNT(l) FROM LoginHistory l WHERE l.status = 'Success' AND l.timestamp >= :since")
    long countSuccessSince(@Param("since") LocalDateTime since);

    List<LoginHistory> findByTimestampAfter(LocalDateTime timestamp, Sort sort);
}
