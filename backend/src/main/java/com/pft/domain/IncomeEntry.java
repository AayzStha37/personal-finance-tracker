package com.pft.domain;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "income_entries")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class IncomeEntry {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "month_id", nullable = false)
    private Long monthId;

    @Column(name = "account_id")
    private Long accountId;

    @Column(name = "source", nullable = false)
    private String source;

    @Column(name = "amount", nullable = false)
    private long amount;

    @Column(name = "currency", nullable = false)
    private String currency;

    @Column(name = "received_date", nullable = false)
    private String receivedDate;

    @Column(name = "week_of_month")
    private Integer weekOfMonth;
}
