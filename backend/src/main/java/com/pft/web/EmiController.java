package com.pft.web;

import com.pft.service.EmiService;
import com.pft.web.dto.Dtos.EmiInstallmentDto;
import com.pft.web.dto.Dtos.EmiPlanDto;
import com.pft.web.dto.Dtos.EmiPlanRequest;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/emi")
public class EmiController {

    private final EmiService emi;

    public EmiController(EmiService emi) {
        this.emi = emi;
    }

    @GetMapping("/plans")
    public List<EmiPlanDto> listPlans() {
        return emi.listPlans();
    }

    @GetMapping("/plans/{id}")
    public EmiPlanDto getPlan(@PathVariable Long id) {
        return emi.getPlan(id);
    }

    @PostMapping("/plans")
    public EmiPlanDto createPlan(@RequestBody @Valid EmiPlanRequest req) {
        return emi.createPlan(req);
    }

    @PostMapping("/plans/{id}/cancel")
    public EmiPlanDto cancelPlan(@PathVariable Long id) {
        return emi.cancelPlan(id);
    }

    @PostMapping("/installments/{id}/skip")
    public EmiInstallmentDto skipInstallment(@PathVariable Long id) {
        return emi.skipInstallment(id);
    }
}
