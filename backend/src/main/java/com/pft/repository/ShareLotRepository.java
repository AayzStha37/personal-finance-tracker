package com.pft.repository;

import com.pft.domain.ShareLot;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ShareLotRepository extends JpaRepository<ShareLot, Long> {

    List<ShareLot> findAllByInvestmentIdOrderByPurchasedDateAsc(Long investmentId);

    List<ShareLot> findAllByMonthIdOrderByPurchasedDateAsc(Long monthId);

    List<ShareLot> findAllByInvestmentId(Long investmentId);
}
