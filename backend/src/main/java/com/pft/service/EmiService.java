package com.pft.service;

import com.pft.domain.*;
import com.pft.repository.*;
import com.pft.web.ApiExceptions.BadRequestException;
import com.pft.web.ApiExceptions.ConflictException;
import com.pft.web.ApiExceptions.NotFoundException;
import com.pft.web.dto.Dtos.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.*;

/**
 * EMI plans and installments. On plan creation all N installments are
 * pre-materialised (linked to any month rows that already exist). The
 * month-init flow in {@link MonthService} calls {@link #materialiseForMonth}
 * to turn every PROJECTED installment due in the newly-created month into an
 * {@link ExpenseEntry}; the installment status flips to PAID once linked.
 */
@Service
@Transactional
public class EmiService {

    private final EmiPlanRepository plans;
    private final EmiInstallmentRepository installments;
    private final ExpenseEntryRepository expenses;
    private final MonthRepository months;
    private final AccountRepository accounts;
    private final BudgetCategoryRepository categories;
    private final CurrencyRepository currencies;
    private final LockGuard lockGuard;

    public EmiService(EmiPlanRepository plans,
                      EmiInstallmentRepository installments,
                      ExpenseEntryRepository expenses,
                      MonthRepository months,
                      AccountRepository accounts,
                      BudgetCategoryRepository categories,
                      CurrencyRepository currencies,
                      LockGuard lockGuard) {
        this.plans = plans;
        this.installments = installments;
        this.expenses = expenses;
        this.months = months;
        this.accounts = accounts;
        this.categories = categories;
        this.currencies = currencies;
        this.lockGuard = lockGuard;
    }

    // ---- Plans ---------------------------------------------------------

    @Transactional(readOnly = true)
    public List<EmiPlanDto> listPlans() {
        return plans.findAllByOrderByActiveDescIdAsc().stream()
                .map(this::toDto).toList();
    }

    @Transactional(readOnly = true)
    public EmiPlanDto getPlan(Long id) {
        return toDto(requirePlan(id));
    }

    public EmiPlanDto createPlan(EmiPlanRequest req) {
        if (!accounts.existsById(req.accountId())) {
            throw new BadRequestException("Unknown account id: " + req.accountId());
        }
        if (!categories.existsById(req.categoryId())) {
            throw new BadRequestException("Unknown category id: " + req.categoryId());
        }
        if (!currencies.existsById(req.currency())) {
            throw new BadRequestException("Unknown currency: " + req.currency());
        }

        Month startMonth = months.findByYearAndMonth(req.startYear(), req.startMonth())
                .orElseThrow(() -> new BadRequestException(
                        "Start month " + req.startYear() + "-"
                                + String.format("%02d", req.startMonth())
                                + " does not exist; create it first"));

        EmiPlan plan = plans.save(EmiPlan.builder()
                .label(req.label())
                .principal(req.principal())
                .installmentAmount(req.installmentAmount())
                .totalInstallments(req.totalInstallments())
                .startMonthId(startMonth.getId())
                .accountId(req.accountId())
                .categoryId(req.categoryId())
                .currency(req.currency())
                .active(true)
                .build());

        int year = req.startYear();
        int month = req.startMonth();
        for (int seq = 1; seq <= req.totalInstallments(); seq++) {
            Optional<Month> due = months.findByYearAndMonth(year, month);
            if (due.isPresent()) {
                EmiInstallment inst = installments.save(EmiInstallment.builder()
                        .planId(plan.getId())
                        .seqNo(seq)
                        .dueMonthId(due.get().getId())
                        .amount(req.installmentAmount())
                        .status(InstallmentStatus.PROJECTED)
                        .build());
                // If the due month already exists and is still writable, auto-
                // project the expense so the schedule is visible immediately.
                if (due.get().getStatus() != MonthStatus.LOCKED) {
                    projectInstallment(plan, inst, due.get());
                }
            }
            // Advance one calendar month
            if (month == 12) { month = 1; year++; } else { month++; }
        }

        return toDto(plan);
    }

    public EmiPlanDto cancelPlan(Long id) {
        EmiPlan p = requirePlan(id);
        if (!p.isActive()) return toDto(p);
        p.setActive(false);
        return toDto(plans.save(p));
    }

    // ---- Installments --------------------------------------------------

    @Transactional(readOnly = true)
    public List<EmiInstallmentDto> listInstallmentsForMonth(Long monthId) {
        List<EmiInstallment> rows = installments.findAllByDueMonthIdOrderBySeqNoAsc(monthId);
        Map<Long, EmiPlan> planMap = plansById(rows);
        Map<Long, Month> monthMap = monthsById(rows);
        return rows.stream().map(i -> toDto(i, planMap, monthMap)).toList();
    }

    public EmiInstallmentDto skipInstallment(Long id) {
        EmiInstallment inst = installments.findById(id).orElseThrow(
                () -> new NotFoundException("Installment " + id + " not found"));
        lockGuard.requireWritable(inst.getDueMonthId());
        if (inst.getExpenseEntryId() != null) {
            expenses.deleteById(inst.getExpenseEntryId());
            inst.setExpenseEntryId(null);
        }
        inst.setStatus(InstallmentStatus.SKIPPED);
        EmiInstallment saved = installments.save(inst);
        EmiPlan plan = requirePlan(saved.getPlanId());
        Month m = months.findById(saved.getDueMonthId()).orElse(null);
        return toDto(saved, plan, m);
    }

    // ---- Month-init hook ----------------------------------------------

    /**
     * Called from {@link MonthService#create} after the balance/budget/investment
     * rollovers. For every PROJECTED installment due in this month (whose plan
     * is still active) we create an expense_entry and flip the installment to
     * PAID.
     */
    public void materialiseForMonth(Month current) {
        // 1. Lazy-create installment rows for active plans whose schedule
        //    lands on this month but were not yet materialised (because the
        //    month did not exist when the plan was created).
        for (EmiPlan plan : plans.findAllByActiveTrue()) {
            Month start = months.findById(plan.getStartMonthId()).orElse(null);
            if (start == null) continue;
            int offset = monthOffset(start.getYear(), start.getMonth(),
                    current.getYear(), current.getMonth());
            if (offset < 0 || offset >= plan.getTotalInstallments()) continue;
            int seq = offset + 1;
            if (installments.findByPlanIdAndSeqNo(plan.getId(), seq).isPresent()) continue;
            installments.save(EmiInstallment.builder()
                    .planId(plan.getId())
                    .seqNo(seq)
                    .dueMonthId(current.getId())
                    .amount(plan.getInstallmentAmount())
                    .status(InstallmentStatus.PROJECTED)
                    .build());
        }

        // 2. Project all PROJECTED installments due this month into expenses.
        List<EmiInstallment> due = installments.findAllByDueMonthIdAndStatus(
                current.getId(), InstallmentStatus.PROJECTED);
        if (due.isEmpty()) return;
        Map<Long, EmiPlan> planMap = plansById(due);
        for (EmiInstallment inst : due) {
            EmiPlan plan = planMap.get(inst.getPlanId());
            if (plan == null || !plan.isActive()) continue;
            projectInstallment(plan, inst, current);
        }
    }

    private static int monthOffset(int startYear, int startMonth, int endYear, int endMonth) {
        return (endYear - startYear) * 12 + (endMonth - startMonth);
    }

    // ---- Helpers -------------------------------------------------------

    private void projectInstallment(EmiPlan plan, EmiInstallment inst, Month dueMonth) {
        if (inst.getStatus() != InstallmentStatus.PROJECTED) return;
        LocalDate txDate = LocalDate.of(dueMonth.getYear(), dueMonth.getMonth(), 1);
        ExpenseEntry e = expenses.save(ExpenseEntry.builder()
                .monthId(dueMonth.getId())
                .categoryId(plan.getCategoryId())
                .accountId(plan.getAccountId())
                .description("EMI: " + plan.getLabel()
                        + " (" + inst.getSeqNo() + "/" + plan.getTotalInstallments() + ")")
                .amount(inst.getAmount())
                .currency(plan.getCurrency())
                .txDate(txDate.toString())
                .emiInstallmentId(inst.getId())
                .build());
        inst.setExpenseEntryId(e.getId());
        inst.setStatus(InstallmentStatus.PAID);
        installments.save(inst);
    }

    private EmiPlan requirePlan(Long id) {
        return plans.findById(id).orElseThrow(
                () -> new NotFoundException("EMI plan " + id + " not found"));
    }

    private Map<Long, EmiPlan> plansById(List<EmiInstallment> rows) {
        Set<Long> ids = new HashSet<>();
        for (EmiInstallment i : rows) ids.add(i.getPlanId());
        Map<Long, EmiPlan> m = new HashMap<>();
        for (EmiPlan p : plans.findAllById(ids)) m.put(p.getId(), p);
        return m;
    }

    private Map<Long, Month> monthsById(List<EmiInstallment> rows) {
        Set<Long> ids = new HashSet<>();
        for (EmiInstallment i : rows) ids.add(i.getDueMonthId());
        Map<Long, Month> m = new HashMap<>();
        for (Month mo : months.findAllById(ids)) m.put(mo.getId(), mo);
        return m;
    }

    private EmiPlanDto toDto(EmiPlan p) {
        List<EmiInstallment> rows = installments.findAllByPlanIdOrderBySeqNoAsc(p.getId());
        Map<Long, Month> monthMap = monthsById(rows);
        List<EmiInstallmentDto> items = rows.stream()
                .map(i -> toDto(i, p, monthMap.get(i.getDueMonthId())))
                .toList();
        return new EmiPlanDto(
                p.getId(), p.getLabel(),
                p.getPrincipal(), p.getInstallmentAmount(), p.getTotalInstallments(),
                p.getStartMonthId(), p.getAccountId(), p.getCategoryId(),
                p.getCurrency(), p.isActive(),
                items);
    }

    private EmiInstallmentDto toDto(EmiInstallment i,
                                    Map<Long, EmiPlan> planMap,
                                    Map<Long, Month> monthMap) {
        EmiPlan p = planMap.get(i.getPlanId());
        Month m = monthMap.get(i.getDueMonthId());
        return toDto(i, p, m);
    }

    private EmiInstallmentDto toDto(EmiInstallment i, EmiPlan p, Month m) {
        return new EmiInstallmentDto(
                i.getId(), i.getPlanId(), p == null ? null : p.getLabel(),
                i.getSeqNo(), p == null ? 0 : p.getTotalInstallments(),
                i.getDueMonthId(),
                m == null ? null : m.getYear(),
                m == null ? null : m.getMonth(),
                i.getAmount(), p == null ? null : p.getCurrency(),
                i.getStatus(), i.getExpenseEntryId());
    }
}
