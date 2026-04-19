package com.pft.domain;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "expense_entries")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ExpenseEntry {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "month_id", nullable = false)
    private Long monthId;

    @Column(name = "category_id", nullable = false)
    private Long categoryId;

    @Column(name = "description", nullable = false)
    private String description;

    @Column(name = "amount", nullable = false)
    private long amount;

    @Column(name = "currency", nullable = false)
    private String currency;

    @Column(name = "tx_date", nullable = false)
    private String txDate;

    @Column(name = "emi_installment_id")
    private Long emiInstallmentId;
}
