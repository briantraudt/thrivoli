/** Financial helpers only. Client values are loaded from protected storage, never bundled. */
export type OverheadCell = {
  location: string;
  category: string;
  sourceCell: string;
  amount: string | null;
};

export function amountToCents(amount: string): number {
  if (!/^\d+(?:\.\d{1,2})?$/.test(amount))
    throw new Error("Expected a non-negative decimal amount");
  const [whole, fraction = ""] = amount.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents))
    throw new Error("Amount exceeds safe precision");
  return cents;
}

export function summarizeOverhead(cells: OverheadCell[]) {
  const byLocation: Record<
    string,
    {
      knownCents: number;
      missingCategories: string[];
      explicitZeroCount: number;
    }
  > = Object.create(null);
  const seen = new Set<string>();
  for (const cell of cells) {
    if (
      !cell.location.trim() ||
      !cell.category.trim() ||
      !cell.sourceCell.trim()
    )
      throw new Error("Missing source identity");
    const key = JSON.stringify([cell.location, cell.category]);
    if (seen.has(key))
      throw new Error(
        "Duplicate location/category: reconcile before importing",
      );
    seen.add(key);
    const row = (byLocation[cell.location] ??= {
      knownCents: 0,
      missingCategories: [],
      explicitZeroCount: 0,
    });
    if (cell.amount === null) row.missingCategories.push(cell.category);
    else {
      const cents = amountToCents(cell.amount);
      row.knownCents += cents;
      if (!Number.isSafeInteger(row.knownCents))
        throw new Error("Total exceeds safe precision");
      if (cents === 0) row.explicitZeroCount++;
    }
  }
  const knownTotalCents = Object.values(byLocation).reduce(
    (sum, row) => sum + row.knownCents,
    0,
  );
  if (!Number.isSafeInteger(knownTotalCents))
    throw new Error("Total exceeds safe precision");
  return {
    byLocation,
    knownTotalCents,
    missingCellCount: Object.values(byLocation).reduce(
      (sum, row) => sum + row.missingCategories.length,
      0,
    ),
    // A complete workbook is not proof that all business expenses are covered.
    profitabilityReady: false as const,
  };
}

export type PeriodAmount = { period: string; cents: number; complete: boolean };
export function operatingProfit(inputs: {
  period: string;
  revenue: PeriodAmount | null;
  directLabor: PeriodAmount | null;
  operatingExpenses: PeriodAmount | null;
  locationOverhead: PeriodAmount | null;
  sharedOverhead: PeriodAmount | null;
  categoriesReconciled: boolean;
}) {
  const keys = [
    "revenue",
    "directLabor",
    "operatingExpenses",
    "locationOverhead",
    "sharedOverhead",
  ] as const;
  const missing: string[] = [];
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(inputs.period))
    missing.push("confirmed reporting month");
  if (!inputs.categoriesReconciled)
    missing.push("reconciled expense classification");
  for (const key of keys) {
    const value = inputs[key];
    if (
      !value ||
      !value.complete ||
      value.period !== inputs.period ||
      !Number.isSafeInteger(value.cents) ||
      value.cents < 0
    )
      missing.push(key);
  }
  if (missing.length)
    return {
      status: "incomplete" as const,
      missing,
      profitCents: null,
      margin: null,
    };
  const revenue = inputs.revenue!.cents;
  const cost = keys.slice(1).reduce((sum, key) => sum + inputs[key]!.cents, 0);
  if (!Number.isSafeInteger(cost))
    throw new Error("Total exceeds safe precision");
  return {
    status: "complete" as const,
    missing,
    profitCents: revenue - cost,
    margin: revenue === 0 ? null : (revenue - cost) / revenue,
  };
}
