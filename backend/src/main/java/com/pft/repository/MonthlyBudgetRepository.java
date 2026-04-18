package com.pft.repository;

import com.pft.domain.MonthlyBudget;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface MonthlyBudgetRepository extends JpaRepository<MonthlyBudget, Long> {

    List<MonthlyBudget> findAllByMonthId(Long monthId);

    Optional<MonthlyBudget> findByMonthIdAndCategoryId(Long monthId, Long categoryId);

    void deleteByMonthId(Long monthId);
}
