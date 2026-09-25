package com.paysonic.tollops.repository;

import com.paysonic.tollops.entity.Lane;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface LaneRepository extends JpaRepository<Lane, String> {
    List<Lane> findByPlazaId(String plazaId);
    void deleteByPlazaIdAndLaneId(String plazaId, String laneId);
}
