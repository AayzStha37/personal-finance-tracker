package com.pft.domain;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;

@Entity
@Table(name = "share_lots")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ShareLot {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "investment_id", nullable = false)
    private Long investmentId;

    @Column(name = "month_id")
    private Long monthId;

    @Column(name = "lot_type", nullable = false)
    @Builder.Default
    private String lotType = "BUY";

    @Column(name = "shares", nullable = false)
    private BigDecimal shares;

    @Column(name = "price_per_share", nullable = false)
    private long pricePerShare;

    @Column(name = "purchased_date", nullable = false)
    private String purchasedDate;
}
