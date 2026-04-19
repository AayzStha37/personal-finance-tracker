package com.pft.web;

import com.pft.service.IncomeService;
import com.pft.web.dto.Dtos.IncomeEntryDto;
import com.pft.web.dto.Dtos.IncomeEntryRequest;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
public class IncomeController {

    private final IncomeService incomes;

    public IncomeController(IncomeService incomes) {
        this.incomes = incomes;
    }

    @GetMapping("/api/months/{monthId}/incomes")
    public List<IncomeEntryDto> list(@PathVariable Long monthId) {
        return incomes.list(monthId);
    }

    @PostMapping("/api/months/{monthId}/incomes")
    public IncomeEntryDto create(@PathVariable Long monthId,
                                 @RequestBody @Valid IncomeEntryRequest req) {
        return incomes.create(monthId, req);
    }

    @PutMapping("/api/incomes/{id}")
    public IncomeEntryDto update(@PathVariable Long id,
                                 @RequestBody @Valid IncomeEntryRequest req) {
        return incomes.update(id, req);
    }

    @DeleteMapping("/api/incomes/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        incomes.delete(id);
        return ResponseEntity.noContent().build();
    }
}
