package com.pft.service;

import com.pft.domain.BudgetCategory;
import com.pft.domain.MonthlyBudget;
import com.pft.repository.BudgetCategoryRepository;
import com.pft.repository.CurrencyRepository;
import com.pft.repository.MonthlyBudgetRepository;
import com.pft.web.ApiExceptions.BadRequestException;
import com.pft.web.ApiExceptions.NotFoundException;
import com.pft.web.dto.Dtos.BudgetCategoryDto;
import com.pft.web.dto.Dtos.BudgetCategoryRequest;
import com.pft.web.dto.Dtos.BudgetDto;
import com.pft.web.dto.Dtos.BudgetUpdate;
import com.pft.web.dto.Dtos.BudgetUpdateRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@Transactional
public class BudgetService {

    private final MonthlyBudgetRepository budgets;
    private final BudgetCategoryRepository categories;
    private final CurrencyRepository currencies;
    private final LockGuard lockGuard;

    public BudgetService(MonthlyBudgetRepository budgets,
                         BudgetCategoryRepository categories,
                         CurrencyRepository currencies,
                         LockGuard lockGuard) {
        this.budgets = budgets;
        this.categories = categories;
        this.currencies = currencies;
        this.lockGuard = lockGuard;
    }

    @Transactional(readOnly = true)
    public List<BudgetCategoryDto> listCategories() {
        return categories.findAllByOrderByDisplayOrderAscIdAsc().stream()
                .map(c -> new BudgetCategoryDto(c.getId(), c.getCode(), c.getLabel(), c.getDisplayOrder()))
                .toList();
    }

    public BudgetCategoryDto createCategory(BudgetCategoryRequest req) {
        categories.findByCode(req.code()).ifPresent(c -> {
            throw new BadRequestException("Category code already exists: " + req.code());
        });
        BudgetCategory c = BudgetCategory.builder()
                .code(req.code())
                .label(req.label())
                .displayOrder(req.displayOrder() == null ? 0 : req.displayOrder())
                .build();
        c = categories.save(c);
        return new BudgetCategoryDto(c.getId(), c.getCode(), c.getLabel(), c.getDisplayOrder());
    }

    @Transactional(readOnly = true)
    public List<BudgetDto> list(Long monthId) {
        Map<Long, BudgetCategory> byId = categoriesById();
        return budgets.findAllByMonthId(monthId).stream()
                .map(b -> toDto(b, byId))
                .sorted((a, b) -> Integer.compare(
                        byId.get(a.categoryId()).getDisplayOrder(),
                        byId.get(b.categoryId()).getDisplayOrder()))
                .toList();
    }

    public List<BudgetDto> bulkUpdate(Long monthId, BudgetUpdateRequest req) {
        lockGuard.requireWritable(monthId);
        Map<Long, BudgetCategory> byId = categoriesById();
        for (BudgetUpdate u : req.budgets()) {
            if (byId.get(u.categoryId()) == null) {
                throw new BadRequestException("Unknown category id: " + u.categoryId());
            }
            if (!currencies.existsById(u.currency())) {
                throw new BadRequestException("Unknown currency: " + u.currency());
            }
            MonthlyBudget b = budgets.findByMonthIdAndCategoryId(monthId, u.categoryId())
                    .orElseGet(() -> MonthlyBudget.builder()
                            .monthId(monthId)
                            .categoryId(u.categoryId())
                            .limitAmount(0L)
                            .currency(u.currency())
                            .build());
            b.setLimitAmount(u.limitAmount());
            b.setCurrency(u.currency());
            budgets.save(b);
        }
        return list(monthId);
    }

    private Map<Long, BudgetCategory> categoriesById() {
        Map<Long, BudgetCategory> m = new HashMap<>();
        for (BudgetCategory c : categories.findAll()) {
            m.put(c.getId(), c);
        }
        return m;
    }

    static BudgetDto toDto(MonthlyBudget b, Map<Long, BudgetCategory> byId) {
        BudgetCategory c = byId.get(b.getCategoryId());
        if (c == null) throw new NotFoundException("Category " + b.getCategoryId() + " not found");
        return new BudgetDto(c.getId(), c.getCode(), c.getLabel(),
                b.getLimitAmount(), b.getCurrency());
    }
}
