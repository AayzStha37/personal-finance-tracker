package com.pft.web.dto;

import com.pft.domain.AccountKind;
import com.pft.domain.MonthStatus;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.util.List;

/**
 * Request / response DTOs for the Month Initialization workflow and the core
 * entity CRUD surfaces. Grouped in one file to keep related shapes together.
 */
public final class Dtos {

    private Dtos() {}

    // ---- Months ----------------------------------------------------------

    public record CreateMonthRequest(
            @Min(1970) @Max(9999) int year,
            @Min(1)    @Max(12)   int month,
            Boolean rolloverBalances,
            Boolean rolloverBudgets,
            Boolean rolloverInvestments) {
    }

    public record MonthDto(
            Long id, int year, int month,
            MonthStatus status, String openedAt, String lockedAt,
            boolean integrityOk, String notes) {
    }

    public record MonthSummaryDto(
            MonthDto month,
            Long previousMonthId,
            List<BalanceDto> balances,
            List<BudgetDto> budgets,
            List<InvestmentSnapshotDto> investments,
            IntegrityCheckDto integrity) {
    }

    public record IntegrityCheckDto(
            boolean ok,
            List<AccountBalanceComparison> comparisons) {
    }

    public record AccountBalanceComparison(
            Long accountId, String accountName, String currency,
            Long previousClosing, Long currentOpening,
            Long delta, boolean matches) {
    }

    // ---- Accounts --------------------------------------------------------

    public record AccountDto(
            Long id, String name, AccountKind kind, String currency,
            boolean active, int displayOrder) {
    }

    public record AccountRequest(
            @NotBlank String name,
            @NotNull  AccountKind kind,
            @NotBlank String currency,
            Boolean active,
            Integer displayOrder) {
    }

    // ---- Balances --------------------------------------------------------

    public record BalanceDto(
            Long accountId, String accountName, String currency,
            Long openingAmount, Long closingAmount) {
    }

    public record BalanceUpdate(
            @NotNull Long accountId,
            Long openingAmount,
            Long closingAmount) {
    }

    public record BalanceUpdateRequest(@NotNull @Valid List<BalanceUpdate> balances) {
    }

    // ---- Budgets ---------------------------------------------------------

    public record BudgetDto(
            Long categoryId, String categoryCode, String categoryLabel,
            Long limitAmount, String currency) {
    }

    public record BudgetUpdate(
            @NotNull Long categoryId,
            @NotNull @PositiveOrZero Long limitAmount,
            @NotBlank String currency) {
    }

    public record BudgetUpdateRequest(@NotNull @Valid List<BudgetUpdate> budgets) {
    }

    // ---- Budget categories ----------------------------------------------

    public record BudgetCategoryDto(Long id, String code, String label, int displayOrder) {
    }

    public record BudgetCategoryRequest(
            @NotBlank String code,
            @NotBlank String label,
            Integer displayOrder) {
    }

    // ---- Investments -----------------------------------------------------

    public record InvestmentDto(
            Long id, String name, String ticker, String type,
            String currency, Long accountId, boolean active) {
    }

    public record InvestmentRequest(
            @NotBlank String name,
            String ticker,
            @NotBlank String type,
            @NotBlank String currency,
            Long accountId,
            Boolean active) {
    }

    public record InvestmentSnapshotDto(
            Long investmentId, String investmentName, String currency,
            BigDecimal shares, Long amountInvested, Long marketValue, Long netChange) {
    }

    public record InvestmentSnapshotUpdate(
            @NotNull Long investmentId,
            @NotNull @PositiveOrZero BigDecimal shares,
            @NotNull @PositiveOrZero Long amountInvested,
            Long marketValue) {
    }

    public record InvestmentSnapshotUpdateRequest(
            @NotNull @Valid List<InvestmentSnapshotUpdate> snapshots) {
    }

    // ---- Currencies ------------------------------------------------------

    public record CurrencyDto(String code, String symbol, int decimals) {
    }

    // ---- Exchange rates --------------------------------------------------

    public record ExchangeRateDto(
            Long id, String fromCurrency, String toCurrency,
            BigDecimal rate, String effectiveMonth, String source, String fetchedAt) {
    }

    public record ExchangeRateUpsert(
            @NotBlank String fromCurrency,
            @NotBlank String toCurrency,
            @NotNull @Positive BigDecimal rate,
            @NotBlank @Pattern(regexp = "\\d{4}-\\d{2}") String effectiveMonth) {
    }

    // ---- Errors ----------------------------------------------------------

    public record ApiError(int status, String error, String message, List<String> details) {
    }
}
