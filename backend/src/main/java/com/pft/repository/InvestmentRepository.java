package com.pft.repository;

import com.pft.domain.Investment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface InvestmentRepository extends JpaRepository<Investment, Long> {

    List<Investment> findAllByActiveTrueOrderByNameAsc();

    List<Investment> findAllByOrderByNameAsc();
}
