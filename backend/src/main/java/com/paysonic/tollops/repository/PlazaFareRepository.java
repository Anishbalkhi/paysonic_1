package com.paysonic.tollops.repository;

import com.paysonic.tollops.entity.PlazaFare;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface PlazaFareRepository extends JpaRepository<PlazaFare, String> {
}
