import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  LOCATIONS,
  CATEGORIES,
  parseFinanceSnapshot,
  financeSummary,
} from "../src/cheshire/finance.ts";
import { createRequestGuard } from "../src/cheshire/requestGuard.ts";

function syntheticSource() {
  return {
    source_name: "Synthetic test fixture only",
    cadence: "monthly",
    effective_month: null,
    imported_at: "2026-10-01T12:00:00Z",
    overhead_rows: LOCATIONS.flatMap((location, index) =>
      CATEGORIES.map((category, row) => ({
        location,
        category,
        sourceCell: `${String.fromCharCode(68 + index)}${row + 5}`,
        amount:
          row === 19
            ? null
            : row === 18
              ? "0"
              : `${(index + 1) * 100 + row}.25`,
      })),
    ),
  };
}

test("complete source matrix retains unknown month, monthly amounts and source references", () => {
  const source = syntheticSource();
  const snapshot = parseFinanceSnapshot(source);
  assert.equal(snapshot.cadence, "monthly");
  assert.equal(snapshot.effectiveMonth, null);
  assert.equal(snapshot.rows.length, 140);
  assert.equal(snapshot.rows[0].amount, "100.25");
  assert.equal(snapshot.rows[0].sourceCell, "D5");
  assert.equal(financeSummary(snapshot).missingCellCount, 7);
  assert.equal(financeSummary(snapshot).zeroCells, 7);
  assert.equal(financeSummary(snapshot).profitabilityReady, false);
});

test("location selection reconciles to company total and never divides monthly values by 12", () => {
  const snapshot = parseFinanceSnapshot(syntheticSource());
  const company = financeSummary(snapshot);
  const locations = LOCATIONS.map((name) => financeSummary(snapshot, name));
  assert.equal(
    locations.reduce((sum, location) => sum + location.knownTotalCents, 0),
    company.knownTotalCents,
  );
  assert.equal(locations[0].knownTotalCents, 195750);
  assert.equal(locations[0].totalCells, 20);
  assert.equal(locations[0].knownCells, 19);
  assert.equal(locations[0].missingCellCount, 1);
});

test("missing rows, duplicate classifications/cells and foreign locations fail closed", () => {
  for (const edit of [
    (s) => s.overhead_rows.pop(),
    (s) => {
      s.overhead_rows[1].category = s.overhead_rows[0].category;
    },
    (s) => {
      s.overhead_rows[1].sourceCell = s.overhead_rows[0].sourceCell;
    },
    (s) => {
      s.overhead_rows[0].location = "Unknown office";
    },
    (s) => {
      s.overhead_rows[0].category = "Other expense";
    },
    (s) => {
      s.overhead_rows[0].sourceCell = "D0";
    },
  ]) {
    const source = syntheticSource();
    edit(source);
    assert.throws(() => parseFinanceSnapshot(source));
  }
});

test("invalid amounts, cadence, dates and missing metadata fail closed", () => {
  for (const amount of [
    -1,
    NaN,
    "",
    "1.123",
    "-2",
    "Infinity",
    "9007199254740992",
    {},
    undefined,
  ]) {
    const source = syntheticSource();
    source.overhead_rows[0].amount = amount;
    assert.throws(() => parseFinanceSnapshot(source));
  }
  for (const override of [
    { cadence: "annual" },
    { effective_month: "" },
    { effective_month: "2026-13-01" },
    { effective_month: "2026-10-02" },
    { effective_month: undefined },
    { imported_at: "invalid" },
    { source_name: "" },
  ]) {
    assert.throws(() =>
      parseFinanceSnapshot({ ...syntheticSource(), ...override }),
    );
  }
});

test("all blanks remain unknown, all explicit zeros remain known without implying profitability", () => {
  for (const amount of [null, "0"]) {
    const source = syntheticSource();
    source.overhead_rows.forEach((row) => {
      row.amount = amount;
    });
    const summary = financeSummary(parseFinanceSnapshot(source));
    assert.equal(summary.knownTotalCents, 0);
    assert.equal(summary.missingCellCount, amount === null ? 140 : 0);
    assert.equal(summary.zeroCells, amount === null ? 0 : 140);
    assert.equal(summary.profitabilityReady, false);
  }
});

test("protected storage requires independent finance readership AND portal membership, with no public seeds", () => {
  const sql = readFileSync(
    new URL(
      "../supabase/migrations/20261001143404_cheshire_finance_snapshots.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(sql, /cheshire_finance_reader enable row level security/);
  assert.match(sql, /cheshire_finance_snapshot enable row level security/);
  assert.match(
    sql,
    /revoke all on public\.cheshire_finance_snapshot from public, anon, authenticated/,
  );
  assert.match(sql, /r\.user_id = \(select auth\.uid\(\)\)/);
  assert.match(
    sql,
    /and exists \(select 1 from public\.cheshire_portal_member/,
  );
  assert.doesNotMatch(
    sql,
    /insert into|grant (?:insert|update|delete|all)[^;]*to (?:anon|authenticated|public)/i,
  );
  assert.match(
    sql,
    /grant select, insert, update, delete on public\.cheshire_finance_snapshot to service_role/,
  );
});

test("request guard rejects old-account data, older refreshes and responses after unmount", async () => {
  const guard = createRequestGuard();
  assert.equal(guard.hasStarted(), false);
  const accountA = guard.begin();
  assert.equal(guard.hasStarted(), true);
  assert.equal(guard.isCurrent(accountA), true);
  const accountB = guard.begin();
  await Promise.resolve(); // account A resolves after B has become current
  assert.equal(guard.isCurrent(accountA), false);
  assert.equal(guard.isCurrent(accountB), true);
  const refresh = guard.begin();
  assert.equal(guard.isCurrent(accountB), false);
  assert.equal(guard.isCurrent(refresh), true);
  guard.invalidate(); // sign out or unmount
  assert.equal(guard.isCurrent(refresh), false);
});

test("auth bootstrap cannot overwrite a newer account event; finance reads invalidate on identity change", () => {
  const guard = createRequestGuard();
  const laterEvent = guard.begin();
  let staleBootstrapApplied = false;
  if (!guard.hasStarted()) {
    staleBootstrapApplied = true;
    guard.begin();
  }
  assert.equal(staleBootstrapApplied, false);
  assert.equal(guard.isCurrent(laterEvent), true);
  const portal = readFileSync(
    new URL("../src/CheshirePortal.tsx", import.meta.url),
    "utf8",
  );
  const dashboard = readFileSync(
    new URL("../src/cheshire/CheshireFinanceDashboard.tsx", import.meta.url),
    "utf8",
  );
  assert.match(portal, /if \(!requests\.hasStarted\(\)\) void authorize/);
  assert.match(portal, /!requests\.isCurrent\(version\)/);
  assert.match(dashboard, /auth\.onAuthStateChange/);
  assert.match(
    dashboard,
    /const version = requests\.begin\(\);\s+setSnapshot\(null\)/,
  );
  assert.match(dashboard, /if \(!current\(\)\) return/g);
  assert.match(dashboard, /authListener\.subscription\.unsubscribe\(\)/);
});

test("production dashboard has no pilot client amounts or therapist name and cannot write financial rows", () => {
  const portal = readFileSync(
    new URL("../src/CheshirePortal.tsx", import.meta.url),
    "utf8",
  );
  const dashboard = readFileSync(
    new URL("../src/cheshire/CheshireFinanceDashboard.tsx", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(
    portal,
    /const locationRows =|monthlyPerformance|cfz-income-hero|6 of 11 complete|55%/,
  );
  assert.doesNotMatch(
    dashboard,
    /\.insert\(|\.upsert\(|\.update\(|localStorage|sessionStorage/,
  );
  assert.match(dashboard, /setSnapshot\(null\)/);
  assert.match(dashboard, /parseFinanceSnapshot\(result\.data\)/);
});

test('spreadsheet summary is namespaced and cannot inherit generic global button layout',()=>{
 const source=readFileSync(new URL('../src/cheshire/CheshireFinanceDashboardView.tsx',import.meta.url),'utf8');
 assert.match(source,/csd-totals/);
 assert.doesNotMatch(source,/className=["']primary["']/);
});

test('fixed baseline requires an explicit owner basis and never invents an accounting month',()=>{
 const source={...syntheticSource(),cost_basis:'fixed_monthly_baseline',basis_note:'Synthetic owner confirmed fixed costs',basis_confirmed_at:'2026-10-01T00:00:00Z',revision_id:'synthetic-revision'};
 const snapshot=parseFinanceSnapshot(source);assert.equal(snapshot.costBasis,'fixed_monthly_baseline');assert.equal(snapshot.effectiveMonth,null);assert.equal(snapshot.revisionId,'synthetic-revision');assert.throws(()=>parseFinanceSnapshot({...source,basis_note:null}));
});

