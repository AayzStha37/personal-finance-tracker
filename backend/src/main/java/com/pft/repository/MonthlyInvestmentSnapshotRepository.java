package com.pft.repository;

import com.pft.domain.MonthlyInvestmentSnapshot;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface MonthlyInvestmentSnapshotRepository
        extends JpaRepository<MonthlyInvestmentSnapshot, Long> {

    List<MonthlyInvestmentSnapshot> findAllByMonthId(Long monthId);

    Optional<MonthlyInvestmentSnapshot> findByMonthIdAndInvestmentId(
            Long monthId, Long investmentId);

    void deleteByMonthId(Long monthId);
}
