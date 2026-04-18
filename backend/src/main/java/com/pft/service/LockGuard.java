package com.pft.service;

import com.pft.domain.Month;
import com.pft.domain.MonthStatus;
import com.pft.repository.MonthRepository;
import com.pft.web.ApiExceptions.ConflictException;
import com.pft.web.ApiExceptions.NotFoundException;
import org.springframework.stereotype.Component;

/**
 * Shared guard that rejects writes into a LOCKED month. Step 5 hooks this into
 * every mutating service path; today it is already wired into the month
 * workflow so future tables can depend on it without a retrofit.
 */
@Component
public class LockGuard {

    private final MonthRepository months;

    public LockGuard(MonthRepository months) {
        this.months = months;
    }

    public Month requireWritable(Long monthId) {
        Month m = months.findById(monthId).orElseThrow(
                () -> new NotFoundException("Month " + monthId + " not found"));
        if (m.getStatus() == MonthStatus.LOCKED) {
            throw new ConflictException(
                    "Month " + m.getYear() + "-" + String.format("%02d", m.getMonth())
                            + " is LOCKED and cannot be modified");
        }
        return m;
    }
}
