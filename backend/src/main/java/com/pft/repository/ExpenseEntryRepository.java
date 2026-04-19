package com.pft.repository;

import com.pft.domain.ExpenseEntry;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ExpenseEntryRepository extends JpaRepository<ExpenseEntry, Long> {

    List<ExpenseEntry> findAllByMonthId(Long monthId);
}
