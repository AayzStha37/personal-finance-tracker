package com.pft.domain;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;

@Entity
@Table(
    name = "exchange_rates",
    uniqueConstraints = @UniqueConstraint(
        columnNames = {"from_currency", "to_currency", "effective_month"})
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ExchangeRate {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "from_currency", nullable = false)
    private String fromCurrency;

    @Column(name = "to_currency", nullable = false)
    private String toCurrency;

    @Column(name = "rate", nullable = false)
    private BigDecimal rate;

    /** YYYY-MM */
    @Column(name = "effective_month", nullable = false)
    private String effectiveMonth;

    @Column(name = "source", nullable = false)
    private String source;

    @Column(name = "fetched_at")
    private String fetchedAt;
}
