package com.pft.web;

import com.pft.service.BalanceService;
import com.pft.service.BudgetService;
import com.pft.service.EmiService;
import com.pft.service.InvestmentService;
import com.pft.service.MonthService;
import com.pft.web.dto.Dtos.*;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/months")
public class MonthController {

    private final MonthService monthService;
    private final BalanceService balanceService;
    private final BudgetService budgetService;
    private final InvestmentService investmentService;
    private final EmiService emiService;

    public MonthController(MonthService monthService,
                           BalanceService balanceService,
                           BudgetService budgetService,
                           InvestmentService investmentService,
                           EmiService emiService) {
        this.monthService = monthService;
        this.balanceService = balanceService;
        this.budgetService = budgetService;
        this.investmentService = investmentService;
        this.emiService = emiService;
    }

    @GetMapping
    public List<MonthDto> list() {
        return monthService.list();
    }

    @GetMapping("/current")
    public ResponseEntity<MonthDto> current() {
        return monthService.findCurrent()
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    @GetMapping("/{id}")
    public MonthDto get(@PathVariable Long id) {
        return monthService.get(id);
    }

    @GetMapping("/{id}/summary")
    public MonthSummaryDto summary(@PathVariable Long id) {
        return monthService.summary(id);
    }

    @PostMapping
    public MonthSummaryDto create(@RequestBody @Valid CreateMonthRequest req) {
        return monthService.create(req);
    }

    @PostMapping("/{id}/integrity-check")
    public IntegrityCheckDto integrityCheck(@PathVariable Long id) {
        return monthService.runIntegrity(id);
    }

    @PostMapping("/{id}/activate")
    public MonthDto activate(@PathVariable Long id) {
        return monthService.activate(id);
    }

    @PostMapping("/{id}/lock")
    public MonthDto lock(@PathVariable Long id) {
        return monthService.lock(id);
    }

    // ---- nested resource endpoints --------------------------------------

    @GetMapping("/{id}/balances")
    public List<BalanceDto> listBalances(@PathVariable Long id) {
        return balanceService.list(id);
    }

    @PutMapping("/{id}/balances")
    public List<BalanceDto> updateBalances(@PathVariable Long id,
                                           @RequestBody @Valid BalanceUpdateRequest body) {
        return balanceService.bulkUpdate(id, body);
    }

    @GetMapping("/{id}/budgets")
    public List<BudgetDto> listBudgets(@PathVariable Long id) {
        return budgetService.list(id);
    }

    @PutMapping("/{id}/budgets")
    public List<BudgetDto> updateBudgets(@PathVariable Long id,
                                         @RequestBody @Valid BudgetUpdateRequest body) {
        return budgetService.bulkUpdate(id, body);
    }

    @GetMapping("/{id}/investments")
    public List<InvestmentSnapshotDto> listInvestmentSnapshots(@PathVariable Long id) {
        return investmentService.listSnapshots(id);
    }

    @PutMapping("/{id}/investments")
    public List<InvestmentSnapshotDto> updateInvestmentSnapshots(
            @PathVariable Long id,
            @RequestBody @Valid InvestmentSnapshotUpdateRequest body) {
        return investmentService.bulkUpsertSnapshots(id, body);
    }

    @GetMapping("/{id}/emi-installments")
    public List<EmiInstallmentDto> listEmiInstallments(@PathVariable Long id) {
        return emiService.listInstallmentsForMonth(id);
    }
}
