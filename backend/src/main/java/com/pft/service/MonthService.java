package com.pft.service;

import com.pft.domain.*;
import com.pft.repository.*;
import com.pft.web.ApiExceptions.BadRequestException;
import com.pft.web.ApiExceptions.ConflictException;
import com.pft.web.ApiExceptions.NotFoundException;
import com.pft.web.dto.Dtos.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;

@Service
@Transactional
public class MonthService {

    private final MonthRepository months;
    private final AccountRepository accounts;
    private final MonthlyBalanceSnapshotRepository balanceSnapshots;
    private final BudgetCategoryRepository categories;
    private final MonthlyBudgetRepository budgets;
    private final BalanceService balanceService;
    private final BudgetService budgetService;
    private final EmiService emiService;

    public MonthService(MonthRepository months,
                        AccountRepository accounts,
                        MonthlyBalanceSnapshotRepository balanceSnapshots,
                        BudgetCategoryRepository categories,
                        MonthlyBudgetRepository budgets,
                        BalanceService balanceService,
                        BudgetService budgetService,
                        EmiService emiService) {
        this.months = months;
        this.accounts = accounts;
        this.balanceSnapshots = balanceSnapshots;
        this.categories = categories;
        this.budgets = budgets;
        this.balanceService = balanceService;
        this.budgetService = budgetService;
        this.emiService = emiService;
    }

    // ---- Queries --------------------------------------------------------

    @Transactional(readOnly = true)
    public List<MonthDto> list() {
        return months.findAllByOrderByYearDescMonthDesc().stream()
                .map(MonthService::toDto).toList();
    }

    @Transactional(readOnly = true)
    public MonthDto get(Long id) {
        return toDto(requireMonth(id));
    }

    @Transactional(readOnly = true)
    public Optional<MonthDto> findCurrent() {
        return months.findFirstByStatusNotOrderByYearDescMonthDesc(MonthStatus.LOCKED)
                .map(MonthService::toDto);
    }

    // ---- Create ---------------------------------------------------------

    /**
     * Create a DRAFT month. Optionally seed its balance snapshots, budgets,
     * and investment snapshots from the most-recent previous month.
     */
    public MonthSummaryDto create(CreateMonthRequest req) {
        months.findByYearAndMonth(req.year(), req.month()).ifPresent(m -> {
            throw new ConflictException("Month "
                    + req.year() + "-" + String.format("%02d", req.month())
                    + " already exists");
        });

        Optional<Month> previous = findPreviousTo(req.year(), req.month());

        Month created = months.save(Month.builder()
                .year(req.year())
                .month(req.month())
                .status(MonthStatus.DRAFT)
                .openedAt(Instant.now().toString())
                .integrityOk(false)
                .build());

        boolean rollBalances = req.rolloverBalances() == null || req.rolloverBalances();
        boolean rollBudgets = req.rolloverBudgets() == null || req.rolloverBudgets();

        if (rollBalances) seedBalances(created, previous);
        if (rollBudgets) seedBudgets(created, previous);

        // Project any EMI installments that come due in this month into
        // concrete expense entries.
        emiService.materialiseForMonth(created);

        // Auto-compute integrity if we can.
        runIntegrity(created, previous);

        return summary(created.getId());
    }

    private void seedBalances(Month current, Optional<Month> previous) {
        Map<Long, Long> prevClosingByAccount = new HashMap<>();
        previous.ifPresent(p -> balanceSnapshots.findAllByMonthId(p.getId()).stream()
                .filter(s -> s.getClosingAmount() != null)
                .forEach(s -> prevClosingByAccount.put(s.getAccountId(), s.getClosingAmount())));

        for (Account a : accounts.findAllByActiveTrueOrderByDisplayOrderAscIdAsc()) {
            Long opening = prevClosingByAccount.getOrDefault(a.getId(), 0L);
            MonthlyBalanceSnapshot s = MonthlyBalanceSnapshot.builder()
                    .monthId(current.getId())
                    .accountId(a.getId())
                    .openingAmount(opening)
                    .build();
            balanceSnapshots.save(s);
        }
    }

    private void seedBudgets(Month current, Optional<Month> previous) {
        Map<Long, MonthlyBudget> prevByCategory = new HashMap<>();
        previous.ifPresent(p -> budgets.findAllByMonthId(p.getId())
                .forEach(b -> prevByCategory.put(b.getCategoryId(), b)));

        for (BudgetCategory c : categories.findAllByOrderByDisplayOrderAscIdAsc()) {
            MonthlyBudget prev = prevByCategory.get(c.getId());
            if (prev == null) continue;
            MonthlyBudget copy = MonthlyBudget.builder()
                    .monthId(current.getId())
                    .categoryId(c.getId())
                    .limitAmount(prev.getLimitAmount())
                    .currency(prev.getCurrency())
                    .build();
            budgets.save(copy);
        }
    }

    // ---- Integrity check ------------------------------------------------

    public IntegrityCheckDto runIntegrity(Long monthId) {
        Month current = requireMonth(monthId);
        Optional<Month> previous = findPreviousTo(current.getYear(), current.getMonth());
        return runIntegrity(current, previous);
    }

    private IntegrityCheckDto runIntegrity(Month current, Optional<Month> previous) {
        Map<Long, Account> accountsById = new HashMap<>();
        for (Account a : accounts.findAll()) accountsById.put(a.getId(), a);

        Map<Long, Long> prevClosing = new HashMap<>();
        previous.ifPresent(p -> balanceSnapshots.findAllByMonthId(p.getId())
                .forEach(s -> prevClosing.put(s.getAccountId(), s.getClosingAmount())));

        List<MonthlyBalanceSnapshot> currentSnaps = balanceSnapshots.findAllByMonthId(current.getId());
        List<AccountBalanceComparison> comparisons = new ArrayList<>();
        boolean allMatch = true;
        for (MonthlyBalanceSnapshot s : currentSnaps) {
            Account a = accountsById.get(s.getAccountId());
            Long prev = prevClosing.get(s.getAccountId());
            long opening = s.getOpeningAmount();
            boolean matches = prev == null
                    ? previous.isEmpty()
                    : prev == opening;
            Long delta = prev == null ? null : opening - prev;
            if (!matches) allMatch = false;
            comparisons.add(new AccountBalanceComparison(
                    a == null ? s.getAccountId() : a.getId(),
                    a == null ? ("#" + s.getAccountId()) : a.getName(),
                    a == null ? null : a.getCurrency(),
                    prev, opening, delta, matches));
        }

        boolean hasAnyBalances = !currentSnaps.isEmpty();
        boolean ok = hasAnyBalances && allMatch;
        if (current.getStatus() != MonthStatus.LOCKED) {
            current.setIntegrityOk(ok);
            months.save(current);
        }
        return new IntegrityCheckDto(ok, comparisons);
    }

    // ---- Activate -------------------------------------------------------

    public MonthDto activate(Long id) {
        Month m = requireMonth(id);
        if (m.getStatus() == MonthStatus.LOCKED) {
            throw new ConflictException("Locked months cannot be activated");
        }
        Optional<Month> previous = findPreviousTo(m.getYear(), m.getMonth());
        IntegrityCheckDto check = runIntegrity(m, previous);
        if (!check.ok()) {
            throw new BadRequestException(
                    "Integrity check failed: opening balances must match previous month's closing");
        }
        m.setStatus(MonthStatus.ACTIVE);
        return toDto(months.save(m));
    }

    // ---- Lock -----------------------------------------------------------

    public MonthDto lock(Long id) {
        Month m = requireMonth(id);
        if (m.getStatus() == MonthStatus.LOCKED) {
            throw new ConflictException("Month is already LOCKED");
        }
        if (m.getStatus() != MonthStatus.ACTIVE) {
            throw new ConflictException("Only ACTIVE months can be locked; activate first");
        }
        if (!m.isIntegrityOk()) {
            throw new BadRequestException(
                    "Cannot lock a month whose integrity check is not passing");
        }
        m.setStatus(MonthStatus.LOCKED);
        m.setLockedAt(Instant.now().toString());
        return toDto(months.save(m));
    }

    // ---- Summary --------------------------------------------------------

    @Transactional(readOnly = true)
    public MonthSummaryDto summary(Long id) {
        Month m = requireMonth(id);
        Optional<Month> previous = findPreviousTo(m.getYear(), m.getMonth());
        return new MonthSummaryDto(
                toDto(m),
                previous.map(Month::getId).orElse(null),
                balanceService.list(id),
                budgetService.list(id),
                integritySnapshot(m, previous));
    }

    private IntegrityCheckDto integritySnapshot(Month current, Optional<Month> previous) {
        // Read-only view: compute without mutating the month row.
        Map<Long, Account> accountsById = new HashMap<>();
        for (Account a : accounts.findAll()) accountsById.put(a.getId(), a);

        Map<Long, Long> prevClosing = new HashMap<>();
        previous.ifPresent(p -> balanceSnapshots.findAllByMonthId(p.getId())
                .forEach(s -> prevClosing.put(s.getAccountId(), s.getClosingAmount())));

        List<AccountBalanceComparison> comparisons = new ArrayList<>();
        boolean allMatch = true;
        List<MonthlyBalanceSnapshot> currentSnaps = balanceSnapshots.findAllByMonthId(current.getId());
        for (MonthlyBalanceSnapshot s : currentSnaps) {
            Account a = accountsById.get(s.getAccountId());
            Long prev = prevClosing.get(s.getAccountId());
            long opening = s.getOpeningAmount();
            boolean matches = prev == null
                    ? previous.isEmpty()
                    : prev == opening;
            Long delta = prev == null ? null : opening - prev;
            if (!matches) allMatch = false;
            comparisons.add(new AccountBalanceComparison(
                    a == null ? s.getAccountId() : a.getId(),
                    a == null ? ("#" + s.getAccountId()) : a.getName(),
                    a == null ? null : a.getCurrency(),
                    prev, opening, delta, matches));
        }
        return new IntegrityCheckDto(!currentSnaps.isEmpty() && allMatch, comparisons);
    }

    // ---- Helpers --------------------------------------------------------

    private Month requireMonth(Long id) {
        return months.findById(id).orElseThrow(
                () -> new NotFoundException("Month " + id + " not found"));
    }

    private Optional<Month> findPreviousTo(int year, int month) {
        int prevYear = month == 1 ? year - 1 : year;
        int prevMonth = month == 1 ? 12 : month - 1;
        return months.findByYearAndMonth(prevYear, prevMonth);
    }

    static MonthDto toDto(Month m) {
        return new MonthDto(m.getId(), m.getYear(), m.getMonth(), m.getStatus(),
                m.getOpenedAt(), m.getLockedAt(), m.isIntegrityOk(), m.getNotes());
    }
}
