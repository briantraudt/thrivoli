import test from "node:test";
import assert from "node:assert/strict";
import {
  amountToCents,
  summarizeOverhead,
  operatingProfit,
} from "../src/cheshire/overhead.ts";
test("decimal amounts retain cents without floating rounding", () => {
  assert.equal(amountToCents("123.40"), 12340);
  assert.equal(amountToCents("0"), 0);
  for (const bad of ["", "1,000", "NaN", "-1", "0.001", "1e3", " 4"])
    assert.throws(() => amountToCents(bad));
});
test("unknown and explicit zero remain distinct; no premature profit claim", () => {
  const result = summarizeOverhead([
    {
      location: "Demo A",
      category: "Rent",
      sourceCell: "D5",
      amount: "100.25",
    },
    { location: "Demo A", category: "Gas", sourceCell: "D7", amount: "0" },
    {
      location: "Demo A",
      category: "Education",
      sourceCell: "D14",
      amount: null,
    },
  ]);
  assert.equal(result.knownTotalCents, 10025);
  assert.equal(result.missingCellCount, 1);
  assert.equal(result.byLocation["Demo A"].explicitZeroCount, 1);
  assert.equal(result.profitabilityReady, false);
});
test("duplicate classifications fail closed rather than double count", () => {
  const cell = {
    location: "Demo",
    category: "EMR",
    sourceCell: "D13",
    amount: "30",
  };
  assert.throws(() =>
    summarizeOverhead([cell, { ...cell, sourceCell: "D25" }]),
  );
});
const value = (cents) => ({ period: "2026-10", cents, complete: true });
const base = () => ({
  period: "2026-10",
  revenue: value(10000),
  directLabor: value(2000),
  operatingExpenses: value(1000),
  locationOverhead: value(3000),
  sharedOverhead: value(500),
  categoriesReconciled: true,
});
test("profit requires matching periods and complete categories", () => {
  assert.equal(operatingProfit(base()).profitCents, 3500);
  assert.equal(
    operatingProfit({ ...base(), sharedOverhead: null }).profitCents,
    null,
  );
  assert.equal(
    operatingProfit({
      ...base(),
      locationOverhead: { ...value(3000), period: "2026-09" },
    }).profitCents,
    null,
  );
  assert.equal(
    operatingProfit({ ...base(), categoriesReconciled: false }).profitCents,
    null,
  );
  assert.equal(operatingProfit({ ...base(), period: "" }).profitCents, null);
});
test("zero revenue is not a zero percent margin; negative profit is retained", () => {
  const result = operatingProfit({ ...base(), revenue: value(0) });
  assert.equal(result.profitCents, -6500);
  assert.equal(result.margin, null);
});
