package com.pft.service;

import com.pft.domain.IncomeEntry;
import com.pft.repository.AccountRepository;
import com.pft.repository.CurrencyRepository;
import com.pft.repository.IncomeEntryRepository;
import com.pft.web.ApiExceptions.BadRequestException;
import com.pft.web.ApiExceptions.NotFoundException;
import com.pft.web.dto.Dtos.IncomeEntryDto;
import com.pft.web.dto.Dtos.IncomeEntryRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional
public class IncomeService {

    private final IncomeEntryRepository incomes;
    private final AccountRepository accounts;
    private final CurrencyRepository currencies;
    private final LockGuard lockGuard;

    public IncomeService(IncomeEntryRepository incomes,
                         AccountRepository accounts,
                         CurrencyRepository currencies,
                         LockGuard lockGuard) {
        this.incomes = incomes;
        this.accounts = accounts;
        this.currencies = currencies;
        this.lockGuard = lockGuard;
    }

    @Transactional(readOnly = true)
    public List<IncomeEntryDto> list(Long monthId) {
        return incomes.findAllByMonthIdOrderByReceivedDateAscIdAsc(monthId).stream()
                .map(IncomeService::toDto).toList();
    }

    public IncomeEntryDto create(Long monthId, IncomeEntryRequest req) {
        lockGuard.requireWritable(monthId);
        validateRefs(req);
        IncomeEntry e = IncomeEntry.builder()
                .monthId(monthId)
                .accountId(req.accountId())
                .source(req.source())
                .amount(req.amount())
                .currency(req.currency())
                .receivedDate(req.receivedDate())
                .weekOfMonth(req.weekOfMonth())
                .build();
        return toDto(incomes.save(e));
    }

    public IncomeEntryDto update(Long id, IncomeEntryRequest req) {
        IncomeEntry e = require(id);
        lockGuard.requireWritable(e.getMonthId());
        validateRefs(req);
        e.setAccountId(req.accountId());
        e.setSource(req.source());
        e.setAmount(req.amount());
        e.setCurrency(req.currency());
        e.setReceivedDate(req.receivedDate());
        e.setWeekOfMonth(req.weekOfMonth());
        return toDto(incomes.save(e));
    }

    public void delete(Long id) {
        IncomeEntry e = require(id);
        lockGuard.requireWritable(e.getMonthId());
        incomes.delete(e);
    }

    private IncomeEntry require(Long id) {
        return incomes.findById(id).orElseThrow(
                () -> new NotFoundException("Income " + id + " not found"));
    }

    private void validateRefs(IncomeEntryRequest req) {
        if (req.accountId() != null && !accounts.existsById(req.accountId())) {
            throw new BadRequestException("Unknown account id: " + req.accountId());
        }
        if (!currencies.existsById(req.currency())) {
            throw new BadRequestException("Unknown currency: " + req.currency());
        }
    }

    static IncomeEntryDto toDto(IncomeEntry e) {
        return new IncomeEntryDto(
                e.getId(), e.getMonthId(), e.getAccountId(), e.getSource(),
                e.getAmount(), e.getCurrency(),
                e.getReceivedDate(), e.getWeekOfMonth());
    }
}
