package com.pft;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * End-to-end workflow test covering month lifecycle, lock enforcement, EMI
 * projection, and expense/income CRUD. One test method so all assertions run
 * against a single Flyway-migrated SQLite file that Spring provisions via the
 * {@link DynamicPropertySource} below.
 */
@SpringBootTest
@AutoConfigureMockMvc
class ApiIntegrationTest {

    @DynamicPropertySource
    static void configureDb(DynamicPropertyRegistry r) throws Exception {
        Path tmp = Files.createTempFile("pft-test-", ".db");
        Files.delete(tmp);
        tmp.toFile().deleteOnExit();
        r.add("spring.datasource.url", () -> "jdbc:sqlite:" + tmp);
    }

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper om;

    @Test
    void fullLifecycle() throws Exception {
        // --- seed: account + category lookup ---------------------------------
        long accountId = postJson("/api/accounts", """
                {"name":"Test Bank","kind":"BANK_SVG","currency":"CAD"}
                """).get("id").asLong();

        JsonNode cats = getJson("/api/budget-categories");
        long mandatoryId = -1;
        for (JsonNode c : cats) {
            if ("MANDATORY".equals(c.get("code").asText())) {
                mandatoryId = c.get("id").asLong();
            }
        }
        assertThat(mandatoryId).isPositive();

        // --- month April 2026: create, set balances, activate ---------------
        long aprilId = postJson("/api/months", """
                {"year":2026,"month":4,"rolloverBalances":false}
                """).get("month").get("id").asLong();

        mvc.perform(put("/api/months/" + aprilId + "/balances")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"balances":[{"accountId":%d,"openingAmount":10000,"closingAmount":10000}]}
                                """.formatted(accountId)))
                .andExpect(status().isOk());

        JsonNode activated = postJson("/api/months/" + aprilId + "/activate", null);
        assertThat(activated.get("status").asText()).isEqualTo("ACTIVE");
        assertThat(activated.get("integrityOk").asBoolean()).isTrue();

        // --- EMI plan: April start, 3 installments. April row auto-paid. ----
        JsonNode plan = postJson("/api/emi/plans", """
                {"label":"Airpods","principal":30000,"installmentAmount":10000,
                 "totalInstallments":3,"startYear":2026,"startMonth":4,
                 "accountId":%d,"categoryId":%d,"currency":"CAD"}
                """.formatted(accountId, mandatoryId));
        assertThat(plan.get("installments")).hasSize(1);
        assertThat(plan.get("installments").get(0).get("status").asText()).isEqualTo("PAID");
        assertThat(plan.get("installments").get(0).get("expenseEntryId").asLong()).isPositive();

        // --- lock April: status flips, lockedAt set --------------------------
        JsonNode locked = postJson("/api/months/" + aprilId + "/lock", null);
        assertThat(locked.get("status").asText()).isEqualTo("LOCKED");
        assertThat(locked.get("lockedAt").asText()).isNotBlank();

        // --- lock enforcement: balance update on LOCKED month returns 409 ---
        mvc.perform(put("/api/months/" + aprilId + "/balances")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"balances":[{"accountId":%d,"openingAmount":10000,"closingAmount":11000}]}
                                """.formatted(accountId)))
                .andExpect(status().isConflict());

        // --- integrity check on LOCKED: returns DTO but does not mutate -----
        mvc.perform(post("/api/months/" + aprilId + "/integrity-check"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ok").value(true));

        // --- create May: EMI seq 2 lazy-materialises and auto-pays ----------
        long mayId = postJson("/api/months", """
                {"year":2026,"month":5,"rolloverBalances":true}
                """).get("month").get("id").asLong();

        JsonNode mayEmis = getJson("/api/months/" + mayId + "/emi-installments");
        assertThat(mayEmis).hasSize(1);
        assertThat(mayEmis.get(0).get("status").asText()).isEqualTo("PAID");
        assertThat(mayEmis.get(0).get("seqNo").asInt()).isEqualTo(2);

        // --- expense CRUD on May --------------------------------------------
        long expId = postJson("/api/months/" + mayId + "/expenses", """
                {"categoryId":%d,"description":"Rent",
                 "amount":150000,"currency":"CAD","txDate":"2026-05-01"}
                """.formatted(mandatoryId)).get("id").asLong();

        JsonNode expList = getJson("/api/months/" + mayId + "/expenses");
        // one EMI-projected expense + the one we just created
        assertThat(expList).hasSize(2);

        postJsonExpect(put("/api/expenses/" + expId), """
                {"categoryId":%d,"description":"Rent (updated)",
                 "amount":160000,"currency":"CAD","txDate":"2026-05-01"}
                """.formatted(mandatoryId), 200);

        // delete on manual expense: OK
        mvc.perform(delete("/api/expenses/" + expId)).andExpect(status().isNoContent());

        // delete on EMI-projected expense: should 409
        long emiExpId = mayEmis.get(0).get("expenseEntryId").asLong();
        mvc.perform(delete("/api/expenses/" + emiExpId)).andExpect(status().isConflict());

        // --- income CRUD on May ---------------------------------------------
        long incId = postJson("/api/months/" + mayId + "/incomes", """
                {"source":"MOMO Business",
                 "amount":48000,"currency":"CAD",
                 "receivedDate":"2026-05-15","weekOfMonth":3}
                """.formatted(accountId)).get("id").asLong();

        JsonNode incList = getJson("/api/months/" + mayId + "/incomes");
        assertThat(incList).hasSize(1);
        assertThat(incList.get(0).get("source").asText()).isEqualTo("MOMO Business");

        mvc.perform(delete("/api/incomes/" + incId)).andExpect(status().isNoContent());

        // --- lock enforcement for expenses: create on locked April 409 ------
        mvc.perform(post("/api/months/" + aprilId + "/expenses")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"categoryId":%d,"description":"x",
                                 "amount":1,"currency":"CAD","txDate":"2026-04-10"}
                                """.formatted(mandatoryId)))
                .andExpect(status().isConflict());

        // --- lock enforcement for incomes: create on locked April 409 ------
        mvc.perform(post("/api/months/" + aprilId + "/incomes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"source":"Salary",
                                 "amount":100,"currency":"CAD",
                                 "receivedDate":"2026-04-15"}
                                """))
                .andExpect(status().isConflict());

        // --- lock can't be re-applied: already LOCKED returns 409 -----------
        mvc.perform(post("/api/months/" + aprilId + "/lock")).andExpect(status().isConflict());

        // --- Investments CRUD -----------------------------------------------
        JsonNode inv = postJson("/api/investments", """
                {"name":"VFV","ticker":"VFV.TO","type":"ETF","currency":"CAD"}
                """);
        long invId = inv.get("id").asLong();
        assertThat(inv.get("name").asText()).isEqualTo("VFV");
        assertThat(inv.get("ticker").asText()).isEqualTo("VFV.TO");
        assertThat(inv.get("type").asText()).isEqualTo("ETF");

        // update investment
        postJsonExpect(put("/api/investments/" + invId), """
                {"name":"VFV Updated","ticker":"VFV.TO","type":"ETF","currency":"CAD"}
                """, 200);

        JsonNode invList = getJson("/api/investments");
        assertThat(invList).hasSize(1);
        assertThat(invList.get(0).get("name").asText()).isEqualTo("VFV Updated");

        // revert name for clarity
        postJsonExpect(put("/api/investments/" + invId), """
                {"name":"VFV","ticker":"VFV.TO","type":"ETF","currency":"CAD"}
                """, 200);

        // --- Share lots: create BUY on ACTIVE month (May) --------------------
        JsonNode lot = postJson("/api/months/" + mayId + "/share-lots", """
                {"investmentId":%d,"shares":10.5,"pricePerShare":5000,"purchasedDate":"2026-05-10"}
                """.formatted(invId));
        long lotId = lot.get("id").asLong();
        assertThat(lot.get("investmentId").asLong()).isEqualTo(invId);
        assertThat(lot.get("shares").decimalValue().doubleValue()).isEqualTo(10.5);
        assertThat(lot.get("pricePerShare").asLong()).isEqualTo(5000);
        assertThat(lot.get("lotType").asText()).isEqualTo("BUY");

        // list lots by investment
        JsonNode lotsByInv = getJson("/api/investments/" + invId + "/lots");
        assertThat(lotsByInv).hasSize(1);

        // list lots by month
        JsonNode lotsByMonth = getJson("/api/months/" + mayId + "/share-lots");
        assertThat(lotsByMonth).hasSize(1);

        // --- Share lots: SELL on ACTIVE month -------------------------------
        JsonNode sellLot = postJson("/api/months/" + mayId + "/share-lots", """
                {"investmentId":%d,"lotType":"SELL","shares":3,"pricePerShare":6000,"purchasedDate":"2026-05-15"}
                """.formatted(invId));
        long sellLotId = sellLot.get("id").asLong();
        assertThat(sellLot.get("lotType").asText()).isEqualTo("SELL");

        // --- Sell more than owned fails (400) --------------------------------
        mvc.perform(post("/api/months/" + mayId + "/share-lots")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"investmentId":%d,"lotType":"SELL","shares":100,"pricePerShare":6000,"purchasedDate":"2026-05-15"}
                                """.formatted(invId)))
                .andExpect(status().isBadRequest());

        // clean up sell lot
        mvc.perform(delete("/api/investments/lots/" + sellLotId))
                .andExpect(status().isNoContent());

        // --- Legacy lot (no month) ------------------------------------------
        JsonNode legacyLot = postJson("/api/investments/lots", """
                {"investmentId":%d,"lotType":"BUY","shares":5,"pricePerShare":4000,"purchasedDate":"2025-01-15"}
                """.formatted(invId));
        long legacyLotId = legacyLot.get("id").asLong();
        assertThat(legacyLot.get("monthId")).isNotNull();
        assertThat(legacyLot.get("monthId").isNull()).isTrue();
        assertThat(legacyLot.get("lotType").asText()).isEqualTo("BUY");

        // delete legacy lot (no lock guard issue)
        mvc.perform(delete("/api/investments/lots/" + legacyLotId))
                .andExpect(status().isNoContent());

        // --- Share lots: create on LOCKED month fails -----------------------
        mvc.perform(post("/api/months/" + aprilId + "/share-lots")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"investmentId":%d,"shares":5,"pricePerShare":5000,"purchasedDate":"2026-04-10"}
                                """.formatted(invId)))
                .andExpect(status().isConflict());

        // --- Delete share lot -----------------------------------------------
        mvc.perform(delete("/api/investments/lots/" + lotId))
                .andExpect(status().isNoContent());
        assertThat(getJson("/api/investments/" + invId + "/lots")).isEmpty();

        // --- Delete investment ----------------------------------------------
        mvc.perform(delete("/api/investments/" + invId))
                .andExpect(status().isNoContent());
        assertThat(getJson("/api/investments")).isEmpty();
    }

    // ---- helpers --------------------------------------------------------

    private JsonNode getJson(String path) throws Exception {
        String body = mvc.perform(get(path))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return om.readTree(body);
    }

    private JsonNode postJson(String path, String body) throws Exception {
        var req = post(path).contentType(MediaType.APPLICATION_JSON);
        if (body != null) req = req.content(body);
        MvcResult res = mvc.perform(req).andExpect(status().is2xxSuccessful()).andReturn();
        String text = res.getResponse().getContentAsString();
        return text.isEmpty() ? om.nullNode() : om.readTree(text);
    }

    private void postJsonExpect(org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder b,
                                String body, int status) throws Exception {
        mvc.perform(b.contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().is(status));
    }
}
