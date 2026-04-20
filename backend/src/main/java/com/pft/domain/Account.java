package com.pft.domain;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "accounts")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Account {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "name", nullable = false, unique = true)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(name = "kind", nullable = false)
    private AccountKind kind;

    @Column(name = "currency", nullable = false)
    private String currency;

    @Column(name = "active", nullable = false)
    private boolean active;
}
