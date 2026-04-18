package com.pft.repository;

import com.pft.domain.BudgetCategory;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface BudgetCategoryRepository extends JpaRepository<BudgetCategory, Long> {

    List<BudgetCategory> findAllByOrderByDisplayOrderAscIdAsc();

    Optional<BudgetCategory> findByCode(String code);
}
