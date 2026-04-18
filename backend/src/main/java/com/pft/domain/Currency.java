package com.pft.domain;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "currencies")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Currency {

    @Id
    @Column(name = "code", nullable = false)
    private String code;

    @Column(name = "symbol", nullable = false)
    private String symbol;

    @Column(name = "decimals", nullable = false)
    private int decimals;
}
