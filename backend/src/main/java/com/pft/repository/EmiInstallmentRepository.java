package com.pft.repository;

import com.pft.domain.EmiInstallment;
import com.pft.domain.InstallmentStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface EmiInstallmentRepository extends JpaRepository<EmiInstallment, Long> {

    List<EmiInstallment> findAllByPlanIdOrderBySeqNoAsc(Long planId);

    List<EmiInstallment> findAllByDueMonthIdOrderBySeqNoAsc(Long dueMonthId);

    List<EmiInstallment> findAllByDueMonthIdAndStatus(Long dueMonthId, InstallmentStatus status);

    Optional<EmiInstallment> findByPlanIdAndSeqNo(Long planId, int seqNo);
}
