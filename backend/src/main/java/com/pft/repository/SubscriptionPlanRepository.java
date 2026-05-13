package com.pft.repository;

import com.pft.domain.SubscriptionPlan;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SubscriptionPlanRepository extends JpaRepository<SubscriptionPlan, Long> {

    List<SubscriptionPlan> findAllByOrderByActiveDescIdAsc();

    List<SubscriptionPlan> findAllByActiveTrue();
}
