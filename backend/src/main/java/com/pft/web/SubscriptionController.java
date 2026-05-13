package com.pft.web;

import com.pft.service.SubscriptionService;
import com.pft.web.dto.Dtos.SubscriptionPlanDto;
import com.pft.web.dto.Dtos.SubscriptionPlanRequest;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/subscriptions")
public class SubscriptionController {

    private final SubscriptionService subscriptions;

    public SubscriptionController(SubscriptionService subscriptions) {
        this.subscriptions = subscriptions;
    }

    @GetMapping("/plans")
    public List<SubscriptionPlanDto> listPlans() {
        return subscriptions.listPlans();
    }

    @PostMapping("/plans")
    public SubscriptionPlanDto createPlan(@RequestBody @Valid SubscriptionPlanRequest req) {
        return subscriptions.createPlan(req);
    }

    @PostMapping("/plans/{id}/cancel")
    public SubscriptionPlanDto cancelPlan(@PathVariable Long id) {
        return subscriptions.cancelPlan(id);
    }

    @DeleteMapping("/plans/{id}")
    @org.springframework.web.bind.annotation.ResponseStatus(org.springframework.http.HttpStatus.NO_CONTENT)
    public void deletePlan(@PathVariable Long id) {
        subscriptions.deletePlan(id);
    }
}
