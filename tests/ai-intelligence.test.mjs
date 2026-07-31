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

console.log("Thrivoli Intelligence evaluation suite passed.");
