package com.paysonic.tollops.repository;

import com.paysonic.tollops.entity.Concessionaire;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ConcessionaireRepository extends JpaRepository<Concessionaire, String> {
}
