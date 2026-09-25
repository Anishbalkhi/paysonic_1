package com.paysonic.tollops.repository;

import com.paysonic.tollops.entity.PlazaCallback;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface PlazaCallbackRepository extends JpaRepository<PlazaCallback, String> {
}
