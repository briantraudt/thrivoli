import { isMonth } from './intake.ts';
import { CATEGORIES, LOCATIONS, type FinanceSnapshot, type LocationName } from './finance.ts';
import { amountToCents } from './overhead.ts';

export type ExecutivePeriod = 'month' | 'quarter' | 'ytd' | 't12';
export type ExecutiveLocation = 'all' | LocationName | 'schools' | 'cash';
export type MoneyPart = { cents: number; basis: string; partial: boolean };
export type Comparison = { label: string; text: string; tone: 'up' | 'down' | 'flat' };
export type CategoryLine = {
  id: string;
  label: string;
  cents: number | null;
  share: number | null;
  trend: Comparison | null;
  priorCents: number | null;
  waiting: string | null;
  basis: string;
  drill: string;
};
export type ExecutiveModel = {
  revenue: MoneyPart | null;
  expenses: MoneyPart | null;
  profitCents: number | null;
  margin: number | null;
  revenueWaiting: string;
  expenseWaiting: string;
  profitWaiting: string;
  revenueComparison: Comparison | null;
  expenseComparison: Comparison | null;
  priorRevenue: number | null;
  priorExpenses: number | null;
  revenueLines: CategoryLine[];
  expenseLines: CategoryLine[];
  beforeShared: string;
  afterShared: string;
};

const PERIODS: ExecutivePeriod[] = ['month', 'quarter', 'ytd', 't12'];

export function addMonths(month: string, delta: number): string {
  if (!isMonth(month) || !Number.isSafeInteger(delta)) throw new Error('Invalid reporting period');
  const cursor = Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1 + delta;
  const year = Math.floor(cursor / 12);
  const next = cursor - year * 12 + 1;
  return `${year}-${String(next).padStart(2, '0')}`;
}

export function executiveMonths(period: ExecutivePeriod, anchor: string): string[] {
  if (!isMonth(anchor) || !PERIODS.includes(period)) throw new Error('Invalid reporting period');
  const month = Number(anchor.slice(5, 7));
  if (period === 'month') return [anchor];
  if (period === 'ytd') return Array.from({ length: month }, (_, index) => addMonths(anchor, index - month + 1));
  if (period === 't12') return Array.from({ length: 12 }, (_, index) => addMonths(anchor, index - 11));
  const quarterStart = addMonths(anchor, -((month - 1) % 3));
  const length = month - Number(quarterStart.slice(5, 7)) + 1;
  return Array.from({ length }, (_, index) => addMonths(quarterStart, index));
}

export function comparisonWindows(period: ExecutivePeriod, anchor: string) {
  const current = executiveMonths(period, anchor);
  const priorYear = current.map(month => addMonths(month, -12));
  if (period === 'ytd' || period === 't12') return { current, priorPeriod: priorYear, priorYear };
  if (period === 'month') return { current, priorPeriod: [addMonths(anchor, -1)], priorYear };
  const previousQuarterStart = addMonths(current[0], -3);
  return { current, priorPeriod: Array.from({ length: current.length }, (_, index) => addMonths(previousQuarterStart, index)), priorYear };
}

export function periodTitle(period: ExecutivePeriod, anchor: string): string {
  const months = executiveMonths(period, anchor);
  const label = (month: string) => new Date(`${month}-01T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
  if (months.length === 1) return label(months[0]);
  return `${label(months[0])}–${label(months.at(-1)!)}`;
}

/** Staff IDs only. A personal name, email, or date is never a therapist filter. */
export function therapistId(value: string): string | null {
  if (!/^[A-Za-z][A-Za-z0-9_-]{1,31}$/.test(value) || !/\d/.test(value)) return null;
  if (/name|patient|client|dob|ssn|birth|email/i.test(value)) return null;
  return value;
}

export function readTherapistIds(documents: readonly { validation?: object | null }[]): string[] {
  const ids = new Set<string>();
  for (const document of documents) {
    const raw = document.validation && 'therapist_ids' in document.validation ? document.validation.therapist_ids : undefined;
    if (!Array.isArray(raw)) continue;
    for (const value of raw) {
      if (typeof value !== 'string') continue;
      const id = therapistId(value);
      if (id) ids.add(id);
    }
  }
  return [...ids].sort();
}

export function parseExecutiveSearch(search: string): { period: ExecutivePeriod; location: ExecutiveLocation; therapist: string; month: string | null } {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const period = PERIODS.includes(params.get('period') as ExecutivePeriod) ? params.get('period') as ExecutivePeriod : 'ytd';
  const rawLocation = params.get('location') ?? 'all';
  const location: ExecutiveLocation = rawLocation === 'all' || rawLocation === 'schools' || rawLocation === 'cash' || LOCATIONS.includes(rawLocation as LocationName) ? rawLocation as ExecutiveLocation : 'all';
  const month = params.get('month');
  return { period, location, therapist: therapistId(params.get('therapist') ?? '') ?? 'all', month: month && isMonth(month) ? month : null };
}

export function executiveSearch(filters: { period: ExecutivePeriod; location: ExecutiveLocation; therapist: string; month: string }): string {
  const params = new URLSearchParams();
  if (filters.period !== 'ytd') params.set('period', filters.period);
  if (filters.location !== 'all') params.set('location', filters.location);
  if (filters.therapist !== 'all') params.set('therapist', filters.therapist);
  if (isMonth(filters.month)) params.set('month', filters.month);
  return params.toString();
}

export function overheadCategoryBreakdown(snapshot: FinanceSnapshot, scope: 'all' | LocationName) {
  const rows = snapshot.rows.filter(row => scope === 'all' || row.location === scope);
  return CATEGORIES.map(category => {
    const cells = rows.filter(row => row.category === category);
    const known = cells.filter(cell => cell.amount !== null);
    if (!known.length) return { category, monthlyCents: null as number | null, missing: cells.length };
    return { category, monthlyCents: known.reduce((sum, cell) => sum + amountToCents(cell.amount!), 0), missing: cells.length - known.length };
  });
}

const CATEGORY_LABELS: Record<string, string> = {
  Rent: 'Rent',
  'Utilities phone': 'Utilities — phone',
  'utilities electric': 'Utilities — electric',
  'utilities gas': 'Utilities — gas',
  insurance: 'Insurance',
  'cleaning service': 'Cleaning',
  'Repair/maintenance': 'Repairs and maintenance',
  'plow/mow': 'Plow and mow',
  dumpster: 'Dumpster',
  'elevator contract': 'Elevator contract',
  alarm: 'Alarm',
  Supplies: 'Supplies',
  EMR: 'EMR',
  Education: 'Education',
  auto: 'Auto',
  'ccmc consultant': 'Consultant',
  'fees (ADP/collections)': 'Payroll and collection fees',
  'microsoft license': 'Microsoft licenses',
  'student loan repayment': 'Student loan repayment',
  'virtual assistant': 'Virtual assistant',
};

export function collectMetricCents(responses: Readonly<Record<string, { sources: readonly { source_type: string; metrics: readonly { key: string; basis: string; value: number; unit: string; scale: number }[] }[] } | undefined>>, months: readonly string[], source: string, keys: readonly string[], basis: string): { cents: number; partial: boolean } | null {
  const hits = months.flatMap(month => {
    const found = responses[month]?.sources.find(item => item.source_type === source);
    if (!found) return [];
    const metrics = found.metrics.filter(metric => keys.includes(metric.key) && metric.basis === basis && metric.unit === 'USD' && metric.scale === 100 && Number.isSafeInteger(metric.value));
    if (new Set(metrics.map(metric => metric.key)).size !== keys.length || metrics.length !== keys.length) return [];
    const value = metrics.reduce((sum, metric) => sum + metric.value, 0);
    return Number.isSafeInteger(value) ? [value] : [];
  });
  if (!hits.length) return null;
  const cents = hits.reduce((sum, value) => sum + value, 0);
  return Number.isSafeInteger(cents) ? { cents, partial: hits.length !== months.length } : null;
}

export function overheadCategoryLabel(category: string) {
  return CATEGORY_LABELS[category] ?? category;
}

function line(id: string, label: string, part: MoneyPart | null, waiting: string, drill: string, share: number | null, trend: Comparison | null, priorCents: number | null): CategoryLine {
  return { id, label, cents: part?.cents ?? null, share, trend, priorCents, waiting: part ? null : waiting, basis: part?.basis ?? '', drill };
}

export function comparisonText(comparison: Comparison | null, current: number | null, prior: number | null) {
  if (!comparison || current === null || prior === null) return 'No earlier period on file';
  if (comparison.tone === 'flat') return comparison.text;
  const change = current - prior;
  return `${change > 0 ? '+' : '−'}${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(change) / 100)} vs ${comparison.label}`;
}

function delta(current: number | null, prior: number | null, label: string): Comparison | null {
  if (current === null || prior === null || !Number.isSafeInteger(current - prior)) return null;
  if (current === prior) return { label, text: `Flat vs ${label}`, tone: 'flat' };
  return { label, text: '', tone: current > prior ? 'up' : 'down' };
}

function shares(lines: CategoryLine[], sameBasis: boolean): CategoryLine[] {
  const valued = lines.filter(item => item.cents !== null);
  const total = valued.reduce((sum, item) => sum + item.cents!, 0);
  if (!sameBasis || valued.length < 2 || total <= 0 || !Number.isSafeInteger(total)) return lines.map(item => ({ ...item, share: null }));
  return lines.map(item => ({ ...item, share: item.cents === null ? null : item.cents / total }));
}

export type ExecutiveInput = {
  scope: ExecutiveLocation;
  therapist: string;
  clinic: MoneyPart | null;
  schools: MoneyPart | null;
  cash: MoneyPart | null;
  overhead: (MoneyPart & { months: number }) | null;
  payroll: MoneyPart | null;
  overheadCategories: { category: string; monthlyCents: number | null; missing: number }[] | null;
  priorClinic: number | null;
  priorSchools: number | null;
  priorCash: number | null;
  priorOverhead: number | null;
  priorOverheadMonths: number | null;
  priorPayroll: number | null;
  priorLabel: string | null;
};

const THERAPIST_WAIT = 'Waiting on a payroll or timesheet export with therapist IDs. Company totals are not one therapist’s numbers.';

export function buildExecutive(input: ExecutiveInput): ExecutiveModel {
  const blocked = input.therapist !== 'all';
  const clinic = blocked ? null : input.scope === 'schools' || input.scope === 'cash' ? null : input.clinic;
  const schools = blocked ? null : input.scope === 'all' || input.scope === 'schools' ? input.schools : null;
  const cash = blocked ? null : input.scope === 'all' || input.scope === 'cash' ? input.cash : null;
  const present = [clinic, schools, cash].filter((part): part is MoneyPart => part !== null);
  const sameRevenueBasis = present.length > 0 && present.every(part => part.basis === present[0].basis && !part.partial);
  const revenue = !blocked && present.length === 1 ? present[0] : null;
  const revenueWaiting = blocked ? 'Waiting on therapist IDs' : present.length > 1
    ? 'Waiting on one reconciled total'
    : input.scope === 'schools' ? 'Waiting on the school workbook or invoices'
    : input.scope === 'cash' ? 'Waiting on the cash-program report'
    : 'Waiting on a PracticePro or QuickBooks export';

  const directCosts = input.scope === 'schools' || input.scope === 'cash';
  const overhead = blocked || directCosts ? null : input.overhead;
  const payroll = blocked || input.scope !== 'all' ? null : input.payroll;
  let expenses: MoneyPart | null = null;
  let expenseWaiting = THERAPIST_WAIT;
  if (!blocked) {
    if (input.scope === 'schools') expenseWaiting = 'Waiting on therapist time and payroll. Clinic rent is not charged to schools.';
    else if (input.scope === 'cash') expenseWaiting = 'Waiting on direct costs for cash programs. Clinic overhead is not applied.';
    else if (overhead) { expenses = overhead; expenseWaiting = ''; }
    else if (payroll) expenseWaiting = 'Waiting on the overhead workbook';
    else expenseWaiting = 'Waiting on the overhead workbook.';
  }

  const profitCents = revenue && expenses && !revenue.partial && !expenses.partial && revenue.basis === expenses.basis && Number.isSafeInteger(revenue.cents - expenses.cents) ? revenue.cents - expenses.cents : null;
  const margin = profitCents !== null && revenue !== null && revenue.cents > 0 ? profitCents / revenue.cents : null;
  const profitWaiting = profitCents !== null ? '' : 'Waiting on full revenue and matching expenses. Profit is not estimated.';

  const priorLabel = input.priorLabel;
  const priorRevenue = revenue === clinic ? input.priorClinic : revenue === schools ? input.priorSchools : revenue === cash ? input.priorCash : null;
  const priorExpenses = expenses === overhead ? input.priorOverhead : expenses === payroll ? input.priorPayroll : null;
  const revenueComparison = revenue && priorLabel ? delta(revenue.cents, priorRevenue, priorLabel) : null;
  const expenseComparison = expenses && priorLabel ? delta(expenses.cents, priorExpenses, priorLabel) : null;

  const revenueLines = shares([
    ...(input.scope === 'all' || (input.scope !== 'schools' && input.scope !== 'cash') ? [line('clinic', 'Clinic visit revenue', clinic, blocked ? THERAPIST_WAIT : 'Waiting on a PracticePro or QuickBooks payments export', 'Payments by payer appear here after a PracticePro export. Treatment type needs that same file.', null, priorLabel ? delta(clinic?.cents ?? null, input.priorClinic, priorLabel) : null, input.priorClinic)] : []),
    ...(input.scope === 'all' || input.scope === 'schools' ? [line('schools', 'School contract revenue', schools, blocked ? THERAPIST_WAIT : 'Waiting on the school workbook or invoices', 'School income stays out of clinic payments until the overlap is reconciled.', null, priorLabel ? delta(schools?.cents ?? null, input.priorSchools, priorLabel) : null, input.priorSchools)] : []),
    ...(input.scope === 'all' || input.scope === 'cash' ? [line('cash', 'Cash specialty programs', cash, blocked ? THERAPIST_WAIT : 'Waiting on the cash-program report', 'Intensive therapy and swim lessons. This is not clinic visit revenue.', null, priorLabel ? delta(cash?.cents ?? null, input.priorCash, priorLabel) : null, input.priorCash)] : []),
  ], sameRevenueBasis && present.length > 1);

  const expenseLines: CategoryLine[] = [];
  if (input.scope === 'schools') {
    expenseLines.push(line('school-labor', 'Therapist labor', null, 'Waiting on therapist time and payroll for school work', 'School profit uses therapist labor only. Clinic rent is not charged here.', null, null, null));
    expenseLines.push(line('school-direct', 'Other direct school costs', null, 'Waiting on school-only costs', 'Supplies or mileage billed to a school contract. Not clinic overhead.', null, null, null));
  } else if (input.scope === 'cash') {
    expenseLines.push(line('cash-direct', 'Direct program costs', null, 'Waiting on direct costs for intensive therapy and swim', 'Pool, instructors, and program supplies. Clinic rent is not applied.', null, null, null));
  } else {
    expenseLines.push(line('payroll', 'Therapist and staff payroll', payroll, blocked ? THERAPIST_WAIT : input.scope === 'all' ? 'Waiting on a payroll export' : 'Waiting on therapist time by location', 'Pay-date gross wages are not fully loaded labor and are not subtracted from the overhead budget.', null, priorLabel ? delta(payroll?.cents ?? null, input.priorPayroll, priorLabel) : null, input.priorPayroll));
    const categories = input.overheadCategories;
    const months = overhead?.months ?? 0;
    if (!categories || !overhead) {
      expenseLines.push(line('overhead', 'Overhead budget', null, 'Waiting on the overhead workbook', 'Rent, utilities, and the other location lines come from that workbook. Blank cells are not zero.', null, null, null));
    } else {
      const priced = categories.map(category => ({ ...category, cents: category.monthlyCents === null ? null : category.monthlyCents * months }));
      const total = priced.reduce((sum, category) => sum + (category.cents ?? 0), 0);
      const priorMonths = input.priorOverheadMonths;
      for (const category of priced) {
        const part = category.cents === null ? null : { cents: category.cents, basis: overhead.basis, partial: category.missing > 0 };
        const priorCents = category.monthlyCents === null || priorMonths === null ? null : category.monthlyCents * priorMonths;
        expenseLines.push(line(`overhead-${category.category}`, overheadCategoryLabel(category.category), part, 'Waiting on this line in the overhead workbook', `${overheadCategoryLabel(category.category)} from the overhead workbook. ${category.missing ? `${category.missing} blank cells are unknown, not zero.` : 'Every cell in this line has an amount.'} Multiplied by ${months} ${months === 1 ? 'month' : 'months'} of the 2026 budget.`, total > 0 && category.cents !== null ? category.cents / total : null, priorLabel ? delta(category.cents, priorCents, priorLabel) : null, priorCents));
      }
    }
  }

  const beforeShared = input.scope === 'schools'
    ? 'Schools are not charged clinic rent or shared overhead. Profit is waiting on school income and therapist time.'
    : input.scope === 'cash'
      ? 'Cash programs are not charged clinic overhead. Profit is waiting on program income and direct program costs.'
      : 'Profit before shared overhead is waiting on full revenue and direct location costs.';
  const afterShared = input.scope === 'schools' || input.scope === 'cash'
    ? 'Shared clinic overhead stays with the clinics.'
    : 'Profit after shared overhead is waiting on a shared-overhead amount. Nothing is allocated until that file is checked.';

  return { revenue, expenses, profitCents, margin, revenueWaiting, expenseWaiting, profitWaiting, revenueComparison, expenseComparison, priorRevenue, priorExpenses, revenueLines, expenseLines, beforeShared, afterShared };
}
