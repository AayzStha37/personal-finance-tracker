package com.pft.web;

import com.pft.service.ExpenseService;
import com.pft.web.dto.Dtos.ExpenseEntryDto;
import com.pft.web.dto.Dtos.ExpenseEntryRequest;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
public class ExpenseController {

    private final ExpenseService expenses;

    public ExpenseController(ExpenseService expenses) {
        this.expenses = expenses;
    }

    @GetMapping("/api/months/{monthId}/expenses")
    public List<ExpenseEntryDto> list(@PathVariable Long monthId) {
        return expenses.list(monthId);
    }

    @PostMapping("/api/months/{monthId}/expenses")
    public ExpenseEntryDto create(@PathVariable Long monthId,
                                  @RequestBody @Valid ExpenseEntryRequest req) {
        return expenses.create(monthId, req);
    }

    @PutMapping("/api/expenses/{id}")
    public ExpenseEntryDto update(@PathVariable Long id,
                                  @RequestBody @Valid ExpenseEntryRequest req) {
        return expenses.update(id, req);
    }

    @DeleteMapping("/api/expenses/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        expenses.delete(id);
        return ResponseEntity.noContent().build();
    }
}
