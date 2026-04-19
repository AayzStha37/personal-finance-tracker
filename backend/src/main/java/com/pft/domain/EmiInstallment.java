package com.pft.domain;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(
    name = "emi_installments",
    uniqueConstraints = @UniqueConstraint(columnNames = {"plan_id", "seq_no"})
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EmiInstallment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "plan_id", nullable = false)
    private Long planId;

    @Column(name = "seq_no", nullable = false)
    private int seqNo;

    @Column(name = "due_month_id", nullable = false)
    private Long dueMonthId;

    @Column(name = "amount", nullable = false)
    private long amount;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private InstallmentStatus status;

    @Column(name = "expense_entry_id")
    private Long expenseEntryId;
}
