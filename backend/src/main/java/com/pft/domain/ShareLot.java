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

    @Column(name = "month_id", nullable = false)
    private Long monthId;

    @Column(name = "shares", nullable = false)
    private BigDecimal shares;

    @Column(name = "buy_price_per_share", nullable = false)
    private long buyPricePerShare;

    @Column(name = "purchased_date", nullable = false)
    private String purchasedDate;
}
