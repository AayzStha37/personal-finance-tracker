package com.pft.service;

import com.pft.domain.ExpenseEntry;
import com.pft.repository.AccountRepository;
import com.pft.repository.BudgetCategoryRepository;
import com.pft.repository.CurrencyRepository;
import com.pft.repository.ExpenseEntryRepository;
import com.pft.web.ApiExceptions.BadRequestException;
import com.pft.web.ApiExceptions.ConflictException;
import com.pft.web.ApiExceptions.NotFoundException;
import com.pft.web.dto.Dtos.ExpenseEntryDto;
import com.pft.web.dto.Dtos.ExpenseEntryRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Manual expense entry CRUD. EMI-projected expenses are created directly by
 * {@link EmiService} and carry a non-null {@code emiInstallmentId}; those rows
 * are read-only from this service's POV (delete/update refused) so that the
 * EMI state machine stays authoritative.
 */
@Service
@Transactional
public class ExpenseService {

    private final ExpenseEntryRepository expenses;
    private final BudgetCategoryRepository categories;
    private final AccountRepository accounts;
    private final CurrencyRepository currencies;
    private final LockGuard lockGuard;

    public ExpenseService(ExpenseEntryRepository expenses,
                          BudgetCategoryRepository categories,
                          AccountRepository accounts,
                          CurrencyRepository currencies,
                          LockGuard lockGuard) {
        this.expenses = expenses;
        this.categories = categories;
        this.accounts = accounts;
        this.currencies = currencies;
        this.lockGuard = lockGuard;
    }

    @Transactional(readOnly = true)
    public List<ExpenseEntryDto> list(Long monthId) {
        return expenses.findAllByMonthIdOrderByTxDateAscIdAsc(monthId).stream()
                .map(ExpenseService::toDto).toList();
    }

    public ExpenseEntryDto create(Long monthId, ExpenseEntryRequest req) {
        lockGuard.requireWritable(monthId);
        validateRefs(req);
        ExpenseEntry e = ExpenseEntry.builder()
                .monthId(monthId)
                .categoryId(req.categoryId())
                .accountId(req.accountId())
                .description(req.description())
                .amount(req.amount())
                .currency(req.currency())
                .txDate(req.txDate())
                .build();
        return toDto(expenses.save(e));
    }

    public ExpenseEntryDto update(Long id, ExpenseEntryRequest req) {
        ExpenseEntry e = require(id);
        lockGuard.requireWritable(e.getMonthId());
        if (e.getEmiInstallmentId() != null) {
            throw new ConflictException(
                    "Cannot edit an EMI-projected expense; skip the installment instead");
        }
        validateRefs(req);
        e.setCategoryId(req.categoryId());
        e.setAccountId(req.accountId());
        e.setDescription(req.description());
        e.setAmount(req.amount());
        e.setCurrency(req.currency());
        e.setTxDate(req.txDate());
        return toDto(expenses.save(e));
    }

    public void delete(Long id) {
        ExpenseEntry e = require(id);
        lockGuard.requireWritable(e.getMonthId());
        if (e.getEmiInstallmentId() != null) {
            throw new ConflictException(
                    "Cannot delete an EMI-projected expense; skip the installment instead");
        }
        expenses.delete(e);
    }

    private ExpenseEntry require(Long id) {
        return expenses.findById(id).orElseThrow(
                () -> new NotFoundException("Expense " + id + " not found"));
    }

    private void validateRefs(ExpenseEntryRequest req) {
        if (!categories.existsById(req.categoryId())) {
            throw new BadRequestException("Unknown category id: " + req.categoryId());
        }
        if (!accounts.existsById(req.accountId())) {
            throw new BadRequestException("Unknown account id: " + req.accountId());
        }
        if (!currencies.existsById(req.currency())) {
            throw new BadRequestException("Unknown currency: " + req.currency());
        }
    }

    static ExpenseEntryDto toDto(ExpenseEntry e) {
        return new ExpenseEntryDto(
                e.getId(), e.getMonthId(), e.getCategoryId(), e.getAccountId(),
                e.getDescription(), e.getAmount(), e.getCurrency(),
                e.getTxDate(), e.getEmiInstallmentId());
    }
}
