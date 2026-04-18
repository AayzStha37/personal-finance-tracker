package com.pft.web;

import com.pft.service.FxService;
import com.pft.web.dto.Dtos.ExchangeRateDto;
import com.pft.web.dto.Dtos.ExchangeRateUpsert;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/exchange-rates")
public class ExchangeRateController {

    private final FxService fx;

    public ExchangeRateController(FxService fx) {
        this.fx = fx;
    }

    @GetMapping
    public List<ExchangeRateDto> list(@RequestParam(required = false) String month) {
        return fx.list(month);
    }

    @PutMapping
    public ExchangeRateDto upsert(@RequestBody @Valid ExchangeRateUpsert req) {
        return fx.upsert(req);
    }

    @PostMapping("/auto-fetch")
    public ExchangeRateDto autoFetch(@RequestParam String from,
                                     @RequestParam String to,
                                     @RequestParam String month) {
        return fx.autoFetch(from, to, month);
    }
}
