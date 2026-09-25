package com.paysonic.tollops.repository;

import com.paysonic.tollops.entity.Plaza;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PlazaRepository extends JpaRepository<Plaza, String> {
    List<Plaza> findByConcessionaireId(String concessionaireId);
    List<Plaza> findByStatus(String status);
}
