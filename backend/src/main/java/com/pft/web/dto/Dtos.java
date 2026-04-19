package com.pft.web.dto;

import com.pft.domain.AccountKind;
import com.pft.domain.InstallmentStatus;
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
            Boolean rolloverBudgets) {
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
            Long id, String name, String ticker, String type, String currency) {
    }

    public record InvestmentRequest(
            @NotBlank String name,
            String ticker,
            @NotBlank String type,
            @NotBlank String currency) {
    }

    // ---- Share lots ------------------------------------------------------

    public record ShareLotDto(
            Long id, Long investmentId, Long monthId,
            BigDecimal shares, long buyPricePerShare, String purchasedDate) {
    }

    public record ShareLotRequest(
            @NotNull Long investmentId,
            @NotNull @DecimalMin("0.0001") BigDecimal shares,
            @NotNull @Positive Long buyPricePerShare,
            @NotBlank @Pattern(regexp = "\\d{4}-\\d{2}-\\d{2}") String purchasedDate) {
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

    // ---- EMI plans & installments ---------------------------------------

    public record EmiPlanDto(
            Long id, String label,
            long principal, long installmentAmount, int totalInstallments,
            Long startMonthId, Long accountId, Long categoryId,
            String currency, boolean active,
            List<EmiInstallmentDto> installments) {
    }

    public record EmiPlanRequest(
            @NotBlank String label,
            @NotNull @PositiveOrZero Long principal,
            @NotNull @PositiveOrZero Long installmentAmount,
            @NotNull @Min(1) @Max(600) Integer totalInstallments,
            @NotNull @Min(1970) @Max(9999) Integer startYear,
            @NotNull @Min(1) @Max(12) Integer startMonth,
            @NotNull Long accountId,
            @NotNull Long categoryId,
            @NotBlank String currency) {
    }

    public record EmiInstallmentDto(
            Long id, Long planId, String planLabel,
            int seqNo, int totalInstallments,
            Long dueMonthId, Integer dueYear, Integer dueMonth,
            long amount, String currency,
            InstallmentStatus status, Long expenseEntryId) {
    }

    public record ExpenseEntryDto(
            Long id, Long monthId, Long categoryId,
            String description, long amount, String currency,
            String txDate, Long emiInstallmentId) {
    }

    public record ExpenseEntryRequest(
            @NotNull Long categoryId,
            @NotBlank String description,
            @NotNull @PositiveOrZero Long amount,
            @NotBlank String currency,
            @NotBlank @Pattern(regexp = "\\d{4}-\\d{2}-\\d{2}") String txDate) {
    }

    // ---- Income ---------------------------------------------------------

    public record IncomeEntryDto(
            Long id, Long monthId, Long accountId, String source,
            long grossAmount, long netAmount, String currency,
            String receivedDate, Integer weekOfMonth) {
    }

    public record IncomeEntryRequest(
            Long accountId,
            @NotBlank String source,
            @NotNull @PositiveOrZero Long grossAmount,
            @NotNull @PositiveOrZero Long netAmount,
            @NotBlank String currency,
            @NotBlank @Pattern(regexp = "\\d{4}-\\d{2}-\\d{2}") String receivedDate,
            @Min(1) @Max(6) Integer weekOfMonth) {
    }

    // ---- Errors ----------------------------------------------------------

    public record ApiError(int status, String error, String message, List<String> details) {
    }
}
