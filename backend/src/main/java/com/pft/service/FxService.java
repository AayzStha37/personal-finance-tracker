package com.pft.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.pft.domain.ExchangeRate;
import com.pft.repository.CurrencyRepository;
import com.pft.repository.ExchangeRateRepository;
import com.pft.web.ApiExceptions.BadRequestException;
import com.pft.web.dto.Dtos.ExchangeRateDto;
import com.pft.web.dto.Dtos.ExchangeRateUpsert;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.math.BigDecimal;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.util.List;

@Service
@Transactional
public class FxService {

    private final ExchangeRateRepository rates;
    private final CurrencyRepository currencies;
    private final ObjectMapper mapper;
    private final HttpClient http;
    private final String baseCurrency;
    private final String providerUrl;
    private final Duration providerTimeout;

    public FxService(ExchangeRateRepository rates,
                     CurrencyRepository currencies,
                     ObjectMapper mapper,
                     @Value("${pft.base-currency:CAD}") String baseCurrency,
                     @Value("${pft.fx.provider-url:https://open.er-api.com/v6/latest/{base}}") String providerUrl,
                     @Value("${pft.fx.timeout-ms:10000}") long timeoutMs) {
        this.rates = rates;
        this.currencies = currencies;
        this.mapper = mapper;
        this.baseCurrency = baseCurrency;
        this.providerUrl = providerUrl;
        this.providerTimeout = Duration.ofMillis(timeoutMs);
        this.http = HttpClient.newBuilder()
                .connectTimeout(this.providerTimeout)
                .build();
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
     * Live fetch against the configured FX provider (default: open.er-api.com,
     * free and keyless). The provider only publishes the latest spot rate, so
     * the value is stored against the requested {@code effectiveMonth} with
     * {@code source=AUTO}. Users can still override with a MANUAL upsert.
     */
    public ExchangeRateDto autoFetch(String fromCurrency, String toCurrency, String effectiveMonth) {
        validateCurrency(fromCurrency);
        validateCurrency(toCurrency);

        BigDecimal fetched = fromCurrency.equalsIgnoreCase(toCurrency)
                ? BigDecimal.ONE
                : fetchSpotRate(fromCurrency, toCurrency);

        ExchangeRate rate = rates.findByFromCurrencyAndToCurrencyAndEffectiveMonth(
                fromCurrency, toCurrency, effectiveMonth)
                .orElseGet(() -> ExchangeRate.builder()
                        .fromCurrency(fromCurrency)
                        .toCurrency(toCurrency)
                        .effectiveMonth(effectiveMonth)
                        .build());
        rate.setRate(fetched);
        rate.setSource("AUTO");
        rate.setFetchedAt(Instant.now().toString());
        return toDto(rates.save(rate));
    }

    private BigDecimal fetchSpotRate(String from, String to) {
        String url = providerUrl.replace("{base}", from.toUpperCase());
        HttpRequest req = HttpRequest.newBuilder(URI.create(url))
                .timeout(providerTimeout)
                .header("Accept", "application/json")
                .GET()
                .build();
        HttpResponse<String> res;
        try {
            res = http.send(req, HttpResponse.BodyHandlers.ofString());
        } catch (IOException e) {
            throw new BadRequestException("FX provider unreachable: " + e.getMessage());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new BadRequestException("FX fetch interrupted");
        }
        if (res.statusCode() / 100 != 2) {
            throw new BadRequestException("FX provider returned HTTP " + res.statusCode());
        }
        JsonNode json;
        try {
            json = mapper.readTree(res.body());
        } catch (IOException e) {
            throw new BadRequestException("FX provider returned invalid JSON");
        }
        // open.er-api.com includes "result":"success" on happy path.
        if (json.has("result") && !"success".equalsIgnoreCase(json.path("result").asText())) {
            throw new BadRequestException("FX provider error: " + json.path("error-type").asText("unknown"));
        }
        JsonNode rateNode = json.path("rates").path(to.toUpperCase());
        if (rateNode.isMissingNode() || rateNode.isNull()) {
            throw new BadRequestException("FX rate not available: " + from + "->" + to);
        }
        try {
            return new BigDecimal(rateNode.asText());
        } catch (NumberFormatException e) {
            throw new BadRequestException("FX provider returned non-numeric rate");
        }
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
