package com.pft.web;

import com.pft.service.InvestmentService;
import com.pft.web.dto.Dtos.InvestmentDto;
import com.pft.web.dto.Dtos.InvestmentRequest;
import com.pft.web.dto.Dtos.ShareLotDto;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/investments")
public class InvestmentController {

    private final InvestmentService investments;

    public InvestmentController(InvestmentService investments) {
        this.investments = investments;
    }

    @GetMapping
    public List<InvestmentDto> list() {
        return investments.list();
    }

    @PostMapping
    public InvestmentDto create(@RequestBody @Valid InvestmentRequest req) {
        return investments.create(req);
    }

    @PutMapping("/{id}")
    public InvestmentDto update(@PathVariable Long id, @RequestBody @Valid InvestmentRequest req) {
        return investments.update(id, req);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        investments.delete(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/lots")
    public List<ShareLotDto> listLots(@PathVariable Long id) {
        return investments.listLotsByInvestment(id);
    }

    @DeleteMapping("/lots/{lotId}")
    public ResponseEntity<Void> deleteLot(@PathVariable Long lotId) {
        investments.deleteLot(lotId);
        return ResponseEntity.noContent().build();
    }
}
