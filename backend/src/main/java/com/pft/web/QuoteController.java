package com.pft.web;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.HashMap;
import java.util.Map;

/**
 * Proxies live stock quotes from Yahoo Finance so the frontend avoids CORS issues.
 * Returns a map of ticker -> current price (as a double).
 */
@RestController
public class QuoteController {

    private final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();
    private final ObjectMapper om = new ObjectMapper();

    @GetMapping("/api/quotes")
    public Map<String, Double> quotes(@RequestParam String tickers) {
        Map<String, Double> result = new HashMap<>();
        if (tickers == null || tickers.isBlank()) return result;

        String url = "https://query1.finance.yahoo.com/v8/finance/spark?symbols="
                + tickers + "&range=1d&interval=1d";
        try {
            HttpRequest req = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .header("User-Agent", "PFT/1.0")
                    .timeout(Duration.ofSeconds(10))
                    .GET()
                    .build();
            HttpResponse<String> res = http.send(req, HttpResponse.BodyHandlers.ofString());
            if (res.statusCode() == 200) {
                JsonNode root = om.readTree(res.body());
                for (String ticker : tickers.split(",")) {
                    String t = ticker.trim();
                    JsonNode spark = root.path(t).path("close");
                    if (spark.isArray() && !spark.isEmpty()) {
                        JsonNode last = spark.get(spark.size() - 1);
                        if (last.isNumber()) {
                            result.put(t, last.doubleValue());
                        }
                    }
                }
            }
        } catch (Exception ignored) {
            // Best-effort: if API fails, return empty map
        }
        return result;
    }
}
