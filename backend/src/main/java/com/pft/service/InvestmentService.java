package com.pft.service;

import com.pft.domain.Investment;
import com.pft.domain.MonthlyInvestmentSnapshot;
import com.pft.repository.CurrencyRepository;
import com.pft.repository.InvestmentRepository;
import com.pft.repository.MonthlyInvestmentSnapshotRepository;
import com.pft.web.ApiExceptions.BadRequestException;
import com.pft.web.ApiExceptions.NotFoundException;
import com.pft.web.dto.Dtos.InvestmentDto;
import com.pft.web.dto.Dtos.InvestmentRequest;
import com.pft.web.dto.Dtos.InvestmentSnapshotDto;
import com.pft.web.dto.Dtos.InvestmentSnapshotUpdate;
import com.pft.web.dto.Dtos.InvestmentSnapshotUpdateRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@Transactional
public class InvestmentService {

    private final InvestmentRepository investments;
    private final MonthlyInvestmentSnapshotRepository snapshots;
    private final CurrencyRepository currencies;
    private final LockGuard lockGuard;

    public InvestmentService(InvestmentRepository investments,
                             MonthlyInvestmentSnapshotRepository snapshots,
                             CurrencyRepository currencies,
                             LockGuard lockGuard) {
        this.investments = investments;
        this.snapshots = snapshots;
        this.currencies = currencies;
        this.lockGuard = lockGuard;
    }

    // ---- Instruments ---------------------------------------------------------

    @Transactional(readOnly = true)
    public List<InvestmentDto> list() {
        return investments.findAllByOrderByNameAsc().stream()
                .map(InvestmentService::toDto).toList();
    }

    public InvestmentDto create(InvestmentRequest req) {
        if (!currencies.existsById(req.currency())) {
            throw new BadRequestException("Unknown currency: " + req.currency());
        }
        Investment i = Investment.builder()
                .name(req.name())
                .ticker(req.ticker())
                .type(req.type())
                .currency(req.currency())
                .accountId(req.accountId())
                .active(req.active() == null || req.active())
                .build();
        return toDto(investments.save(i));
    }

    public InvestmentDto update(Long id, InvestmentRequest req) {
        Investment i = investments.findById(id).orElseThrow(
                () -> new NotFoundException("Investment " + id + " not found"));
        if (!currencies.existsById(req.currency())) {
            throw new BadRequestException("Unknown currency: " + req.currency());
        }
        i.setName(req.name());
        i.setTicker(req.ticker());
        i.setType(req.type());
        i.setCurrency(req.currency());
        i.setAccountId(req.accountId());
        if (req.active() != null) i.setActive(req.active());
        return toDto(investments.save(i));
    }

    public void delete(Long id) {
        if (!investments.existsById(id)) {
            throw new NotFoundException("Investment " + id + " not found");
        }
        investments.deleteById(id);
    }

    // ---- Snapshots -----------------------------------------------------------

    @Transactional(readOnly = true)
    public List<InvestmentSnapshotDto> listSnapshots(Long monthId) {
        Map<Long, Investment> byId = investmentsById();
        return snapshots.findAllByMonthId(monthId).stream()
                .map(s -> toSnapshotDto(s, byId))
                .sorted((a, b) -> a.investmentName().compareToIgnoreCase(b.investmentName()))
                .toList();
    }

    public List<InvestmentSnapshotDto> bulkUpsertSnapshots(
            Long monthId, InvestmentSnapshotUpdateRequest req) {
        lockGuard.requireWritable(monthId);
        Map<Long, Investment> byId = investmentsById();
        for (InvestmentSnapshotUpdate u : req.snapshots()) {
            Investment inv = byId.get(u.investmentId());
            if (inv == null) {
                throw new BadRequestException("Unknown investment id: " + u.investmentId());
            }
            MonthlyInvestmentSnapshot s = snapshots
                    .findByMonthIdAndInvestmentId(monthId, u.investmentId())
                    .orElseGet(() -> MonthlyInvestmentSnapshot.builder()
                            .monthId(monthId)
                            .investmentId(u.investmentId())
                            .shares(u.shares())
                            .amountInvested(u.amountInvested())
                            .build());
            s.setShares(u.shares());
            s.setAmountInvested(u.amountInvested());
            s.setMarketValue(u.marketValue());
            snapshots.save(s);
        }
        return listSnapshots(monthId);
    }

    private Map<Long, Investment> investmentsById() {
        Map<Long, Investment> m = new HashMap<>();
        for (Investment i : investments.findAll()) {
            m.put(i.getId(), i);
        }
        return m;
    }

    static InvestmentDto toDto(Investment i) {
        return new InvestmentDto(i.getId(), i.getName(), i.getTicker(),
                i.getType(), i.getCurrency(), i.getAccountId(), i.isActive());
    }

    static InvestmentSnapshotDto toSnapshotDto(MonthlyInvestmentSnapshot s,
                                               Map<Long, Investment> byId) {
        Investment inv = byId.get(s.getInvestmentId());
        if (inv == null) {
            throw new NotFoundException("Investment " + s.getInvestmentId() + " not found");
        }
        return new InvestmentSnapshotDto(inv.getId(), inv.getName(), inv.getCurrency(),
                s.getShares(), s.getAmountInvested(), s.getMarketValue(), s.getNetChange());
    }
}
