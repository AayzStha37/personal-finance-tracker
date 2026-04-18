package com.pft.domain;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(
    name = "monthly_budgets",
    uniqueConstraints = @UniqueConstraint(columnNames = {"month_id", "category_id"})
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MonthlyBudget {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "month_id", nullable = false)
    private Long monthId;

    @Column(name = "category_id", nullable = false)
    private Long categoryId;

    @Column(name = "limit_amount", nullable = false)
    private long limitAmount;

    @Column(name = "currency", nullable = false)
    private String currency;
}
