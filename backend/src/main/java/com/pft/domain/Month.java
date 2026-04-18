package com.pft.domain;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(
    name = "months",
    uniqueConstraints = @UniqueConstraint(columnNames = {"year", "month"})
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Month {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "year", nullable = false)
    private int year;

    @Column(name = "month", nullable = false)
    private int month;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private MonthStatus status;

    @Column(name = "opened_at")
    private String openedAt;

    @Column(name = "locked_at")
    private String lockedAt;

    @Column(name = "integrity_ok", nullable = false)
    private boolean integrityOk;

    @Column(name = "notes")
    private String notes;
}
