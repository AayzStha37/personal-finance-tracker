package com.pft.repository;

import com.pft.domain.EmiPlan;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface EmiPlanRepository extends JpaRepository<EmiPlan, Long> {

    List<EmiPlan> findAllByOrderByActiveDescIdAsc();

    List<EmiPlan> findAllByActiveTrue();
}
