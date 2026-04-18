package com.pft.service;

import com.pft.domain.ExchangeRate;
import com.pft.repository.CurrencyRepository;
import com.pft.repository.ExchangeRateRepository;
import com.pft.web.ApiExceptions.BadRequestException;
import com.pft.web.dto.Dtos.ExchangeRateDto;
import com.pft.web.dto.Dtos.ExchangeRateUpsert;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

@Service
@Transactional
public class FxService {

    private final ExchangeRateRepository rates;
    private final CurrencyRepository currencies;
    private final String baseCurrency;

    public FxService(ExchangeRateRepository rates,
                     CurrencyRepository currencies,
                     @Value("${pft.base-currency:CAD}") String baseCurrency) {
        this.rates = rates;
        this.currencies = currencies;
        this.baseCurrency = baseCurrency;
    }

    public String baseCurrency() {
        return baseCurrency;
    }

    @Transactional(readOnly = true)
    public List<ExchangeRateDto> list(String effectiveMonth) {
        List<ExchangeRate> list = (effectiveMonth == null)
                ? rates.findAll()
                : rates.findAllByEffectiveMonth(effectiveMonth);
        return list.stream().map(FxService::toDto).toList();
    }

    public ExchangeRateDto upsert(ExchangeRateUpsert req) {
        validateCurrency(req.fromCurrency());
        validateCurrency(req.toCurrency());
        ExchangeRate rate = rates.findByFromCurrencyAndToCurrencyAndEffectiveMonth(
                req.fromCurrency(), req.toCurrency(), req.effectiveMonth())
                .orElseGet(() -> ExchangeRate.builder()
                        .fromCurrency(req.fromCurrency())
                        .toCurrency(req.toCurrency())
                        .effectiveMonth(req.effectiveMonth())
                        .build());
        rate.setRate(req.rate());
        rate.setSource("MANUAL");
        rate.setFetchedAt(Instant.now().toString());
        return toDto(rates.save(rate));
    }

    /**
     * Placeholder for auto-fetch; the live HTTP integration lands with the
     * New Month wizard in Step 4. For now the endpoint exposes a deterministic
     * identity rate so the workflow can round-trip end-to-end.
     */
    public ExchangeRateDto autoFetch(String fromCurrency, String toCurrency, String effectiveMonth) {
        validateCurrency(fromCurrency);
        validateCurrency(toCurrency);
        ExchangeRate rate = rates.findByFromCurrencyAndToCurrencyAndEffectiveMonth(
                fromCurrency, toCurrency, effectiveMonth)
                .orElseGet(() -> ExchangeRate.builder()
                        .fromCurrency(fromCurrency)
                        .toCurrency(toCurrency)
                        .effectiveMonth(effectiveMonth)
                        .build());
        // Identity placeholder; real HTTP fetch arrives in Step 4.
        rate.setRate(java.math.BigDecimal.ONE);
        rate.setSource("AUTO");
        rate.setFetchedAt(Instant.now().toString());
        return toDto(rates.save(rate));
    }

    private void validateCurrency(String code) {
        if (!currencies.existsById(code)) {
            throw new BadRequestException("Unknown currency: " + code);
        }
    }

    static ExchangeRateDto toDto(ExchangeRate r) {
        return new ExchangeRateDto(r.getId(), r.getFromCurrency(), r.getToCurrency(),
                r.getRate(), r.getEffectiveMonth(), r.getSource(), r.getFetchedAt());
    }
}
