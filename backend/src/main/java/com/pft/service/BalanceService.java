package com.pft.service;

import com.pft.domain.Account;
import com.pft.domain.MonthlyBalanceSnapshot;
import com.pft.repository.AccountRepository;
import com.pft.repository.MonthlyBalanceSnapshotRepository;
import com.pft.web.ApiExceptions.BadRequestException;
import com.pft.web.ApiExceptions.NotFoundException;
import com.pft.web.dto.Dtos.BalanceDto;
import com.pft.web.dto.Dtos.BalanceUpdate;
import com.pft.web.dto.Dtos.BalanceUpdateRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@Transactional
public class BalanceService {

    private final MonthlyBalanceSnapshotRepository snapshots;
    private final AccountRepository accounts;
    private final LockGuard lockGuard;

    public BalanceService(MonthlyBalanceSnapshotRepository snapshots,
                          AccountRepository accounts,
                          LockGuard lockGuard) {
        this.snapshots = snapshots;
        this.accounts = accounts;
        this.lockGuard = lockGuard;
    }

    @Transactional(readOnly = true)
    public List<BalanceDto> list(Long monthId) {
        Map<Long, Account> byId = accountsById();
        return snapshots.findAllByMonthId(monthId).stream()
                .map(s -> toDto(s, byId))
                .sorted((a, b) -> Long.compare(a.accountId(), b.accountId()))
                .toList();
    }

    public List<BalanceDto> bulkUpdate(Long monthId, BalanceUpdateRequest req) {
        lockGuard.requireWritable(monthId);
        Map<Long, Account> byId = accountsById();
        for (BalanceUpdate u : req.balances()) {
            Account a = byId.get(u.accountId());
            if (a == null) {
                throw new BadRequestException("Unknown account id: " + u.accountId());
            }
            MonthlyBalanceSnapshot s = snapshots.findByMonthIdAndAccountId(monthId, u.accountId())
                    .orElseGet(() -> MonthlyBalanceSnapshot.builder()
                            .monthId(monthId)
                            .accountId(u.accountId())
                            .openingAmount(0L)
                            .build());
            if (u.openingAmount() != null) s.setOpeningAmount(u.openingAmount());
            if (u.closingAmount() != null) s.setClosingAmount(u.closingAmount());
            snapshots.save(s);
        }
        return list(monthId);
    }

    private Map<Long, Account> accountsById() {
        Map<Long, Account> m = new HashMap<>();
        for (Account a : accounts.findAll()) {
            m.put(a.getId(), a);
        }
        return m;
    }

    static BalanceDto toDto(MonthlyBalanceSnapshot s, Map<Long, Account> byId) {
        Account a = byId.get(s.getAccountId());
        if (a == null) {
            throw new NotFoundException("Account " + s.getAccountId() + " not found");
        }
        return new BalanceDto(a.getId(), a.getName(), a.getCurrency(),
                s.getOpeningAmount(), s.getClosingAmount());
    }
}
