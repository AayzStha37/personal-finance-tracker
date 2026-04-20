package com.pft.web;

import com.pft.domain.Currency;
import com.pft.repository.CurrencyRepository;
import com.pft.web.dto.Dtos.CurrencyDto;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/currencies")
public class CurrencyController {

    private final CurrencyRepository currencies;
    private final String baseCurrency;

    public CurrencyController(CurrencyRepository currencies,
                               @Value("${pft.base-currency:CAD}") String baseCurrency) {
        this.currencies = currencies;
        this.baseCurrency = baseCurrency;
    }

    @GetMapping
    public Map<String, Object> list() {
        List<CurrencyDto> list = currencies.findAll().stream()
                .sorted((a, b) -> a.getCode().compareTo(b.getCode()))
                .map(CurrencyController::toDto)
                .toList();
        return Map.of("base", baseCurrency, "currencies", list);
    }

    static CurrencyDto toDto(Currency c) {
        return new CurrencyDto(c.getCode(), c.getSymbol(), c.getDecimals());
    }
}
