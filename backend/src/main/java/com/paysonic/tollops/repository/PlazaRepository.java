package com.paysonic.tollops.repository;

import com.paysonic.tollops.entity.Plaza;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PlazaRepository extends JpaRepository<Plaza, String> {
    List<Plaza> findByConcessionaireId(String concessionaireId);
    List<Plaza> findByStatus(String status);
    Optional<Plaza> findByNameIgnoreCase(String name);
    Optional<Plaza> findByOrgIdIgnoreCase(String orgId);
    Optional<Plaza> findByGeoCode(String geoCode);
}
