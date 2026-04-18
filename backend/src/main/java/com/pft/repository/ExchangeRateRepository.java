package com.pft.repository;

import com.pft.domain.ExchangeRate;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ExchangeRateRepository extends JpaRepository<ExchangeRate, Long> {

    List<ExchangeRate> findAllByEffectiveMonth(String effectiveMonth);

    Optional<ExchangeRate> findByFromCurrencyAndToCurrencyAndEffectiveMonth(
            String from, String to, String effectiveMonth);
}
