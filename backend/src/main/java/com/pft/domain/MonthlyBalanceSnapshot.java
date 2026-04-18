package com.pft.domain;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(
    name = "monthly_balance_snapshots",
    uniqueConstraints = @UniqueConstraint(columnNames = {"month_id", "account_id"})
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MonthlyBalanceSnapshot {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "month_id", nullable = false)
    private Long monthId;

    @Column(name = "account_id", nullable = false)
    private Long accountId;

    @Column(name = "opening_amount", nullable = false)
    private long openingAmount;

    @Column(name = "closing_amount")
    private Long closingAmount;
}
