package com.pft.web;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class HealthController {

    private final JdbcTemplate jdbc;

    public HealthController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @GetMapping("/ping")
    public Map<String, Object> ping() {
        List<String> currencies = jdbc.queryForList(
                "SELECT code FROM currencies ORDER BY code", String.class);
        List<String> categories = jdbc.queryForList(
                "SELECT code FROM budget_categories ORDER BY display_order", String.class);
        return Map.of(
                "status", "ok",
                "currencies", currencies,
                "categories", categories);
    }
}
