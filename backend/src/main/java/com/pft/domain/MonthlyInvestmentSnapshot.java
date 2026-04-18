package com.pft.domain;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;

@Entity
@Table(
    name = "monthly_investment_snapshots",
    uniqueConstraints = @UniqueConstraint(columnNames = {"month_id", "investment_id"})
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MonthlyInvestmentSnapshot {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "month_id", nullable = false)
    private Long monthId;

    @Column(name = "investment_id", nullable = false)
    private Long investmentId;

    @Column(name = "shares", nullable = false)
    private BigDecimal shares;

    @Column(name = "amount_invested", nullable = false)
    private long amountInvested;

    @Column(name = "market_value")
    private Long marketValue;

    @Column(name = "net_change")
    private Long netChange;
}
