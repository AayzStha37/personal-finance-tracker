package com.pft.service;

import com.pft.domain.Account;
import com.pft.repository.AccountRepository;
import com.pft.repository.CurrencyRepository;
import com.pft.web.ApiExceptions.BadRequestException;
import com.pft.web.ApiExceptions.NotFoundException;
import com.pft.web.dto.Dtos.AccountDto;
import com.pft.web.dto.Dtos.AccountRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional
public class AccountService {

    private final AccountRepository accounts;
    private final CurrencyRepository currencies;

    public AccountService(AccountRepository accounts, CurrencyRepository currencies) {
        this.accounts = accounts;
        this.currencies = currencies;
    }

    @Transactional(readOnly = true)
    public List<AccountDto> list() {
        return accounts.findAllByOrderByIdAsc().stream()
                .map(AccountService::toDto).toList();
    }

    public AccountDto create(AccountRequest req) {
        validateCurrency(req.currency());
        Account a = Account.builder()
                .name(req.name())
                .kind(req.kind())
                .currency(req.currency())
                .active(req.active() == null || req.active())
                .build();
        return toDto(accounts.save(a));
    }

    public AccountDto update(Long id, AccountRequest req) {
        Account a = accounts.findById(id).orElseThrow(
                () -> new NotFoundException("Account " + id + " not found"));
        validateCurrency(req.currency());
        a.setName(req.name());
        a.setKind(req.kind());
        a.setCurrency(req.currency());
        if (req.active() != null) a.setActive(req.active());
        return toDto(accounts.save(a));
    }

    public void delete(Long id) {
        if (!accounts.existsById(id)) {
            throw new NotFoundException("Account " + id + " not found");
        }
        accounts.deleteById(id);
    }

    private void validateCurrency(String code) {
        if (!currencies.existsById(code)) {
            throw new BadRequestException("Unknown currency: " + code);
        }
    }

    static AccountDto toDto(Account a) {
        return new AccountDto(a.getId(), a.getName(), a.getKind(), a.getCurrency(),
                a.isActive());
    }
}
