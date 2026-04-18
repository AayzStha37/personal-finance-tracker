package com.pft.web;

import com.pft.service.AccountService;
import com.pft.web.dto.Dtos.AccountDto;
import com.pft.web.dto.Dtos.AccountRequest;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/accounts")
public class AccountController {

    private final AccountService accounts;

    public AccountController(AccountService accounts) {
        this.accounts = accounts;
    }

    @GetMapping
    public List<AccountDto> list() {
        return accounts.list();
    }

    @PostMapping
    public AccountDto create(@RequestBody @Valid AccountRequest req) {
        return accounts.create(req);
    }

    @PutMapping("/{id}")
    public AccountDto update(@PathVariable Long id, @RequestBody @Valid AccountRequest req) {
        return accounts.update(id, req);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        accounts.delete(id);
        return ResponseEntity.noContent().build();
    }
}
