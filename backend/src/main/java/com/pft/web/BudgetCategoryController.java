package com.pft.web;

import com.pft.service.BudgetService;
import com.pft.web.dto.Dtos.BudgetCategoryDto;
import com.pft.web.dto.Dtos.BudgetCategoryRequest;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/budget-categories")
public class BudgetCategoryController {

    private final BudgetService budgets;

    public BudgetCategoryController(BudgetService budgets) {
        this.budgets = budgets;
    }

    @GetMapping
    public List<BudgetCategoryDto> list() {
        return budgets.listCategories();
    }

    @PostMapping
    public BudgetCategoryDto create(@RequestBody @Valid BudgetCategoryRequest req) {
        return budgets.createCategory(req);
    }
}
