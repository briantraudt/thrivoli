import assert from "node:assert/strict";
import { resolveQuestion } from "../api/_lib/thrivoli-intelligence.js";

const torringtonYtd = resolveQuestion("What were Torrington YTD sales?");
assert.equal(torringtonYtd.unsupportedPeriod, "year-to-date");
assert.equal(torringtonYtd.card.value, "$66,200");
assert.equal(torringtonYtd.context.value, 66200);

const poolBreakEven = resolveQuestion("What is break even for the Pool Location?");
assert.equal(poolBreakEven.card.value, "500");

const revenueComparison = resolveQuestion("Compare revenue across all locations");
assert.equal(revenueComparison.answerType, "comparison");
assert.equal(revenueComparison.chart.length, 7);
assert.equal(revenueComparison.chart.find((row) => row.label === "Orange").display, "$79,400");

const followUp = resolveQuestion("How does that compare?", [
  { role: "user", content: "What is Torrington revenue?" },
  { role: "assistant", content: "Torrington revenue is $66,200." },
]);
assert.equal(followUp.answerType, "comparison");
assert.equal(followUp.metricKey, "revenue");

const liveDataset = {
  locations: [{ name: "Orange", visits: 900, breakEven: 500, revenue: 123456, margin: 0.28, capacity: 0.91, noShowRate: 0.05, openSlots: 20 }],
  organization: { name: "Client", revenue: 123456, visits: 900, breakEven: 500, operatingMargin: 0.28 },
  reportingPeriod: "2026-07-01 through 2026-07-31 month-to-date",
  dataAsOf: "2026-07-31T23:59:00Z",
  roleScope: "Executive — all authorized locations",
};
const liveRevenue = resolveQuestion("What was Orange revenue this month?", [], liveDataset);
assert.equal(liveRevenue.card.value, "$123,456");
assert.equal(liveRevenue.dataStatus, "Live aggregate data; no patient-level PHI");
assert.equal(liveRevenue.roleScope, "Executive — all authorized locations");

console.log("Thrivoli Intelligence evaluation suite passed.");
