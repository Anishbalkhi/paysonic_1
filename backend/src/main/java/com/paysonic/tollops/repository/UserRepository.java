package com.paysonic.tollops.repository;

import com.paysonic.tollops.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, String> {
    Optional<User> findByEmail(String email);
    Optional<User> findByEmailIgnoreCase(String email);
    Optional<User> findByNameIgnoreCase(String name);
    List<User> findByApproval(String approval);
    List<User> findByLocked(boolean locked);
    List<User> findByRole(String role);
    List<User> findByStatus(String status);
    long countByStatus(String status);
    long countByLocked(boolean locked);
}
