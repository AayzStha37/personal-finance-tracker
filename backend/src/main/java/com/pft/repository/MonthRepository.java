package com.pft.repository;

import com.pft.domain.Month;
import com.pft.domain.MonthStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface MonthRepository extends JpaRepository<Month, Long> {

    Optional<Month> findByYearAndMonth(int year, int month);

    List<Month> findAllByOrderByYearDescMonthDesc();

    Optional<Month> findFirstByStatusNotOrderByYearDescMonthDesc(MonthStatus status);

    Optional<Month> findFirstByOrderByYearDescMonthDesc();
}
