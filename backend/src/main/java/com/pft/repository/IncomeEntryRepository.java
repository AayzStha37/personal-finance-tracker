package com.pft.repository;

import com.pft.domain.IncomeEntry;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface IncomeEntryRepository extends JpaRepository<IncomeEntry, Long> {

    List<IncomeEntry> findAllByMonthIdOrderByReceivedDateAscIdAsc(Long monthId);
}
