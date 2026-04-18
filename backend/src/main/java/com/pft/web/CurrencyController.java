package com.pft.web;

import com.pft.domain.Currency;
import com.pft.repository.CurrencyRepository;
import com.pft.service.FxService;
import com.pft.web.dto.Dtos.CurrencyDto;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/currencies")
public class CurrencyController {

    private final CurrencyRepository currencies;
    private final FxService fx;

    public CurrencyController(CurrencyRepository currencies, FxService fx) {
        this.currencies = currencies;
        this.fx = fx;
    }

    @GetMapping
    public Map<String, Object> list() {
        List<CurrencyDto> list = currencies.findAll().stream()
                .sorted((a, b) -> a.getCode().compareTo(b.getCode()))
                .map(CurrencyController::toDto)
                .toList();
        return Map.of("base", fx.baseCurrency(), "currencies", list);
    }

    static CurrencyDto toDto(Currency c) {
        return new CurrencyDto(c.getCode(), c.getSymbol(), c.getDecimals());
    }
}
