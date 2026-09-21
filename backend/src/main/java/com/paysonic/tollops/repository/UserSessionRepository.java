package com.paysonic.tollops.repository;

import com.paysonic.tollops.entity.UserSession;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface UserSessionRepository extends JpaRepository<UserSession, String> {
    List<UserSession> findByStatus(String status);
    List<UserSession> findByUserId(String userId);
    long countByStatus(String status);
}
