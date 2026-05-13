package com.pft.service;

import com.pft.domain.*;
import com.pft.repository.*;
import com.pft.web.ApiExceptions.BadRequestException;
import com.pft.web.ApiExceptions.NotFoundException;
import com.pft.web.dto.Dtos.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

/**
 * Subscription plans: recurring monthly expenses (e.g. Netflix, gym) that
 * auto-generate expense entries on each new month's creation.
 */
@Service
@Transactional
public class SubscriptionService {

    private final SubscriptionPlanRepository plans;
    private final ExpenseEntryRepository expenses;
    private final MonthRepository months;
    private final BudgetCategoryRepository categories;
    private final CurrencyRepository currencies;

    public SubscriptionService(SubscriptionPlanRepository plans,
            ExpenseEntryRepository expenses,
            MonthRepository months,
            BudgetCategoryRepository categories,
            CurrencyRepository currencies) {
        this.plans = plans;
        this.expenses = expenses;
        this.months = months;
        this.categories = categories;
        this.currencies = currencies;
    }

    // ---- Plans ---------------------------------------------------------

    @Transactional(readOnly = true)
    public List<SubscriptionPlanDto> listPlans() {
        return plans.findAllByOrderByActiveDescIdAsc().stream()
                .map(SubscriptionService::toDto).toList();
    }

    public SubscriptionPlanDto createPlan(SubscriptionPlanRequest req) {
        if (!currencies.existsById(req.currency())) {
            throw new BadRequestException("Unknown currency: " + req.currency());
        }

        Long categoryId = categories.findByCode("SUBSCRIPTION")
                .orElseThrow(() -> new BadRequestException("SUBSCRIPTION budget category not found"))
                .getId();

        Month startMonth = months.findByYearAndMonth(req.startYear(), req.startMonth())
                .orElseThrow(() -> new BadRequestException(
                        "Start month " + req.startYear() + "-"
                                + String.format("%02d", req.startMonth())
                                + " does not exist; create it first"));

        SubscriptionPlan plan = plans.save(SubscriptionPlan.builder()
                .label(req.label())
                .amount(req.amount())
                .categoryId(categoryId)
                .currency(req.currency())
                .startMonthId(startMonth.getId())
                .active(true)
                .build());

        // Backfill all existing non-locked months from start month onwards.
        // This covers the case where future months were already created before
        // the subscription was added.
        months.findAll().stream()
                .filter(m -> monthOffset(startMonth.getYear(), startMonth.getMonth(),
                        m.getYear(), m.getMonth()) >= 0)
                .filter(m -> m.getStatus() != MonthStatus.LOCKED)
                .forEach(m -> projectExpense(plan, m));

        return toDto(plan);
    }

    public SubscriptionPlanDto cancelPlan(Long id) {
        SubscriptionPlan p = requirePlan(id);
        if (!p.isActive())
            return toDto(p);
        p.setActive(false);
        return toDto(plans.save(p));
    }

    public void deletePlan(Long id) {
        SubscriptionPlan p = requirePlan(id);
        plans.delete(p);
    }

    // ---- Month-init hook ----------------------------------------------

    /**
     * Called from {@link MonthService#create} after EMI materialisation.
     * For every active subscription whose start month is at or before the new
     * month, creates an expense entry (idempotent: skipped if one already exists).
     */
    public void materialiseForMonth(Month current) {
        for (SubscriptionPlan plan : plans.findAllByActiveTrue()) {
            Month start = months.findById(plan.getStartMonthId()).orElse(null);
            if (start == null)
                continue;

            int offset = monthOffset(start.getYear(), start.getMonth(),
                    current.getYear(), current.getMonth());
            if (offset < 0)
                continue; // subscription hasn't started yet

            // Idempotency guard
            if (expenses.existsBySubscriptionPlanIdAndMonthId(plan.getId(), current.getId())) {
                continue;
            }

            projectExpense(plan, current);
        }
    }

    // ---- Helpers -------------------------------------------------------

    private void projectExpense(SubscriptionPlan plan, Month month) {
        LocalDate txDate = LocalDate.of(month.getYear(), month.getMonth(), 1);
        expenses.save(ExpenseEntry.builder()
                .monthId(month.getId())
                .categoryId(plan.getCategoryId())
                .description(plan.getLabel())
                .amount(plan.getAmount())
                .currency(plan.getCurrency())
                .txDate(txDate.toString())
                .subscriptionPlanId(plan.getId())
                .build());
    }

    private SubscriptionPlan requirePlan(Long id) {
        return plans.findById(id).orElseThrow(
                () -> new NotFoundException("Subscription plan " + id + " not found"));
    }

    private static int monthOffset(int startYear, int startMonth, int endYear, int endMonth) {
        return (endYear - startYear) * 12 + (endMonth - startMonth);
    }

    static SubscriptionPlanDto toDto(SubscriptionPlan p) {
        return new SubscriptionPlanDto(
                p.getId(), p.getLabel(), p.getAmount(),
                p.getCategoryId(), p.getCurrency(),
                p.getStartMonthId(), p.isActive());
    }
}
