package com.pft.domain;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "emi_plans")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EmiPlan {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "label", nullable = false)
    private String label;

    @Column(name = "principal", nullable = false)
    private long principal;

    @Column(name = "installment_amount", nullable = false)
    private long installmentAmount;

    @Column(name = "total_installments", nullable = false)
    private int totalInstallments;

    @Column(name = "start_month_id", nullable = false)
    private Long startMonthId;

    @Column(name = "account_id", nullable = false)
    private Long accountId;

    @Column(name = "category_id", nullable = false)
    private Long categoryId;

    @Column(name = "currency", nullable = false)
    private String currency;

    @Column(name = "active", nullable = false)
    private boolean active;
}
