package com.pft.service;

import com.pft.domain.Investment;
import com.pft.domain.ShareLot;
import com.pft.repository.CurrencyRepository;
import com.pft.repository.InvestmentRepository;
import com.pft.repository.ShareLotRepository;
import com.pft.web.ApiExceptions.BadRequestException;
import com.pft.web.ApiExceptions.NotFoundException;
import com.pft.web.dto.Dtos.InvestmentDto;
import com.pft.web.dto.Dtos.InvestmentRequest;
import com.pft.web.dto.Dtos.ShareLotDto;
import com.pft.web.dto.Dtos.ShareLotRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

@Service
@Transactional
public class InvestmentService {

    private final InvestmentRepository investments;
    private final ShareLotRepository shareLots;
    private final CurrencyRepository currencies;
    private final LockGuard lockGuard;

    public InvestmentService(InvestmentRepository investments,
                             ShareLotRepository shareLots,
                             CurrencyRepository currencies,
                             LockGuard lockGuard) {
        this.investments = investments;
        this.shareLots = shareLots;
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
                .build();
        return toDto(investments.save(i));
    }

    public InvestmentDto update(Long id, InvestmentRequest req) {
        Investment i = requireInvestment(id);
        if (!currencies.existsById(req.currency())) {
            throw new BadRequestException("Unknown currency: " + req.currency());
        }
        i.setName(req.name());
        i.setTicker(req.ticker());
        i.setType(req.type());
        i.setCurrency(req.currency());
        return toDto(investments.save(i));
    }

    public void delete(Long id) {
        if (!investments.existsById(id)) {
            throw new NotFoundException("Investment " + id + " not found");
        }
        investments.deleteById(id);
    }

    // ---- Share lots ----------------------------------------------------------

    @Transactional(readOnly = true)
    public List<ShareLotDto> listLotsByInvestment(Long investmentId) {
        requireInvestment(investmentId);
        return shareLots.findAllByInvestmentIdOrderByPurchasedDateAsc(investmentId).stream()
                .map(InvestmentService::toLotDto).toList();
    }

    @Transactional(readOnly = true)
    public List<ShareLotDto> listLotsByMonth(Long monthId) {
        return shareLots.findAllByMonthIdOrderByPurchasedDateAsc(monthId).stream()
                .map(InvestmentService::toLotDto).toList();
    }

    public ShareLotDto createLot(Long monthId, ShareLotRequest req) {
        lockGuard.requireWritable(monthId);
        requireInvestment(req.investmentId());
        String lotType = req.lotType() != null ? req.lotType() : "BUY";
        if ("SELL".equals(lotType)) {
            validateSellQuantity(req.investmentId(), req.shares());
        }
        ShareLot lot = ShareLot.builder()
                .investmentId(req.investmentId())
                .monthId(monthId)
                .lotType(lotType)
                .shares(req.shares())
                .pricePerShare(req.pricePerShare())
                .purchasedDate(req.purchasedDate())
                .build();
        return toLotDto(shareLots.save(lot));
    }

    public ShareLotDto createLegacyLot(ShareLotRequest req) {
        requireInvestment(req.investmentId());
        String lotType = req.lotType() != null ? req.lotType() : "BUY";
        if ("SELL".equals(lotType)) {
            validateSellQuantity(req.investmentId(), req.shares());
        }
        ShareLot lot = ShareLot.builder()
                .investmentId(req.investmentId())
                .monthId(null)
                .lotType(lotType)
                .shares(req.shares())
                .pricePerShare(req.pricePerShare())
                .purchasedDate(req.purchasedDate())
                .build();
        return toLotDto(shareLots.save(lot));
    }

    public void deleteLot(Long lotId) {
        ShareLot lot = shareLots.findById(lotId).orElseThrow(
                () -> new NotFoundException("Share lot " + lotId + " not found"));
        if (lot.getMonthId() != null) {
            lockGuard.requireWritable(lot.getMonthId());
        }
        shareLots.delete(lot);
    }

    // ---- Helpers -------------------------------------------------------------

    private void validateSellQuantity(Long investmentId, BigDecimal sellShares) {
        List<ShareLot> allLots = shareLots.findAllByInvestmentId(investmentId);
        BigDecimal netShares = BigDecimal.ZERO;
        for (ShareLot lot : allLots) {
            if ("BUY".equals(lot.getLotType())) {
                netShares = netShares.add(lot.getShares());
            } else {
                netShares = netShares.subtract(lot.getShares());
            }
        }
        if (netShares.compareTo(sellShares) < 0) {
            throw new BadRequestException("Cannot sell " + sellShares
                    + " shares; only " + netShares + " available");
        }
    }

    private Investment requireInvestment(Long id) {
        return investments.findById(id).orElseThrow(
                () -> new NotFoundException("Investment " + id + " not found"));
    }

    static InvestmentDto toDto(Investment i) {
        return new InvestmentDto(i.getId(), i.getName(), i.getTicker(),
                i.getType(), i.getCurrency());
    }

    static ShareLotDto toLotDto(ShareLot s) {
        return new ShareLotDto(s.getId(), s.getInvestmentId(), s.getMonthId(),
                s.getLotType(), s.getShares(), s.getPricePerShare(), s.getPurchasedDate());
    }
}
