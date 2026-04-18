package com.pft.repository;

import com.pft.domain.MonthlyBalanceSnapshot;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface MonthlyBalanceSnapshotRepository
        extends JpaRepository<MonthlyBalanceSnapshot, Long> {

    List<MonthlyBalanceSnapshot> findAllByMonthId(Long monthId);

    Optional<MonthlyBalanceSnapshot> findByMonthIdAndAccountId(Long monthId, Long accountId);

    void deleteByMonthId(Long monthId);
}
