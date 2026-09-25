package com.paysonic.tollops.repository;

import com.paysonic.tollops.entity.PlazaCch;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface PlazaCchRepository extends JpaRepository<PlazaCch, String> {
}
