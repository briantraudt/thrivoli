import { summarizeOverhead, type OverheadCell } from "./overhead.ts";

// Location labels are a reporting scope, not a claim of a verified database mapping.
export const LOCATIONS = [
  "Cheshire",
  "Cromwell",
  "Guilford",
  "Meriden",
  "Orange",
  "Pool",
  "Torrington",
] as const;
export const CATEGORIES = [
  "Rent",
  "Utilities phone",
  "utilities electric",
  "utilities gas",
  "insurance",
  "cleaning service",
  "Repair/maintenance",
  "plow/mow",
  "dumpster",
  "elevator contract",
  "alarm",
  "Supplies",
  "EMR",
  "Education",
  "auto",
  "ccmc consultant",
  "fees (ADP/collections)",
  "microsoft license",
  "student loan repayment",
  "virtual assistant",
] as const;
export type LocationName = (typeof LOCATIONS)[number];
export type FinanceSnapshot = {
  sourceName: string;
  costBasis: "monthly_source" | "fixed_monthly_baseline";
  basisNote: string | null;
  basisConfirmedAt: string | null;
  revisionId: string | null;
  cadence: "monthly";
  effectiveMonth: string | null;
  importedAt: string;
  rows: OverheadCell[];
};

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid financial source");
  return value as Record<string, unknown>;
}

/** Fail closed on malformed data; an omitted cell is never interpreted as zero. */
export function parseFinanceSnapshot(input: unknown): FinanceSnapshot {
  const value = record(input);
  const costBasis = value.cost_basis ?? "monthly_source";
  if (!["monthly_source", "fixed_monthly_baseline"].includes(String(costBasis))) throw new Error("Invalid cost basis");
  if (costBasis === "fixed_monthly_baseline" && (typeof value.basis_note !== "string" || !value.basis_note.trim() || typeof value.basis_confirmed_at !== "string" || !Number.isFinite(Date.parse(value.basis_confirmed_at)))) throw new Error("Unconfirmed fixed cost basis");
  if (value.cadence !== "monthly")
    throw new Error("Monthly source basis has not been confirmed");
  if (
    typeof value.source_name !== "string" ||
    value.source_name.length < 1 ||
    value.source_name.length > 120
  )
    throw new Error("Missing source reference");
  if (
    value.effective_month !== null &&
    (typeof value.effective_month !== "string" ||
      !/^\d{4}-(0[1-9]|1[0-2])-01$/.test(value.effective_month))
  )
    throw new Error("Invalid accounting month");
  if (
    typeof value.imported_at !== "string" ||
    !Number.isFinite(Date.parse(value.imported_at))
  )
    throw new Error("Missing import timestamp");
  if (
    !Array.isArray(value.overhead_rows) ||
    value.overhead_rows.length !== LOCATIONS.length * CATEGORIES.length
  )
    throw new Error("Incomplete source matrix");
  const sourceCells = new Set<string>();
  const rows = value.overhead_rows.map((raw): OverheadCell => {
    const row = record(raw);
    if (
      !LOCATIONS.includes(row.location as LocationName) ||
      !CATEGORIES.includes(row.category as (typeof CATEGORIES)[number])
    )
      throw new Error("Unrecognized reporting classification");
    if (
      typeof row.sourceCell !== "string" ||
      !/^[A-Z]{1,3}[1-9]\d{0,5}$/.test(row.sourceCell) ||
      sourceCells.has(row.sourceCell)
    )
      throw new Error("Invalid or repeated source cell");
    sourceCells.add(row.sourceCell);
    if (row.amount !== null && typeof row.amount !== "string")
      throw new Error("Invalid source amount");
    return {
      location: row.location as string,
      category: row.category as string,
      sourceCell: row.sourceCell,
      amount: row.amount as string | null,
    };
  });
  summarizeOverhead(rows); // validates decimal precision and unique location/category pairs
  return {
    sourceName: value.source_name,
    costBasis: costBasis as FinanceSnapshot["costBasis"],
    basisNote: typeof value.basis_note === "string" ? value.basis_note : null,
    basisConfirmedAt: typeof value.basis_confirmed_at === "string" ? value.basis_confirmed_at : null,
    revisionId: typeof value.revision_id === "string" ? value.revision_id : null,
    cadence: "monthly",
    effectiveMonth: value.effective_month as string | null,
    importedAt: value.imported_at,
    rows,
  };
}

export function financeSummary(
  snapshot: FinanceSnapshot,
  location: string = "all",
) {
  const rows = snapshot.rows.filter(
    (row) => location === "all" || row.location === location,
  );
  const summary = summarizeOverhead(rows);
  const knownCells = rows.filter((row) => row.amount !== null).length;
  return {
    ...summary,
    rows,
    knownCells,
    totalCells: rows.length,
    zeroCells: Object.values(summary.byLocation).reduce(
      (n, row) => n + row.explicitZeroCount,
      0,
    ),
  };
}

export function money(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export const LABOR_ROLES = [
  {
    name: "Therapists",
    detail: "Salary or hourly pay, taxes, benefits, PTO and bonuses",
  },
  {
    name: "Supervisors",
    detail: "Clinical time and supervision allocated separately",
  },
  {
    name: "Clinic managers",
    detail: "Direct location time and shared responsibilities",
  },
  { name: "Executive team", detail: "Approved allocation across the business" },
  { name: "Office & scheduling", detail: "Clinic and school administration" },
  {
    name: "Billing & authorization",
    detail: "Allocate once; reconcile collection fees",
  },
] as const;
