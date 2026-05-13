package com.pft.domain;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "subscription_plans")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SubscriptionPlan {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "label", nullable = false)
    private String label;

    @Column(name = "amount", nullable = false)
    private long amount;

    @Column(name = "category_id", nullable = false)
    private Long categoryId;

    @Column(name = "currency", nullable = false)
    private String currency;

    @Column(name = "start_month_id", nullable = false)
    private Long startMonthId;

    @Column(name = "active", nullable = false)
    private boolean active;
}
