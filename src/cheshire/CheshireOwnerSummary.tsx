import { useEffect, useId, useRef, useState } from 'react';
import { estimatedFixedOverhead } from './overheadEstimate';
import { LOCATIONS, money, type FinanceSnapshot } from './finance';
import type { PeriodMode } from './periodSummary';
import type { ProfitCenterScope } from './profitCenterScope';
import './owner-summary.css';

const BREAK_EVEN = 'Fixed site costs, plus that clinic’s share of shared overhead, plus salaried labor, divided by what is left from one visit after variable costs.';
const MARGIN_VISITS = 'The same inputs as break-even, after the target margin is taken out of the revenue per visit. The target itself is not chosen here until the visit math can run.';
const MISSING_VISITS = 'Still needed: monthly visits and payments from PracticePro, loaded labor (pay plus employer taxes and benefits), and a therapist timesheet by location.';

const DEFINITIONS: { term: string; basis: string; means: string }[] = [
  { term: 'Reported payments', basis: 'Payment date, service date, or a report-as-of snapshot — whichever file was uploaded. Only one basis is shown.', means: 'Cash or attributed payments already in a source file. This is not profit, and it is not added to school invoices.' },
  { term: 'Estimated overhead', basis: 'Budget. The 2026 monthly workbook amount times the number of months in the period, including November and December.', means: 'A planning figure. Blank cells stay unknown and are never treated as zero. It is not QuickBooks spending and it is not subtracted from payments.' },
  { term: 'Profit', basis: 'Not calculated.', means: 'Payment dates, service dates, invoices, the overhead budget, and payroll pay dates are different clocks. They are not subtracted from each other.' },
  { term: 'Visits to break even', basis: 'Not calculated.', means: `${BREAK_EVEN} ${MISSING_VISITS}` },
  { term: 'Visits for a target margin', basis: 'Not calculated.', means: `${MARGIN_VISITS} ${MISSING_VISITS}` },
  { term: 'School income', basis: 'Workbook or invoice, kept as its own source.', means: 'School contracts are their own business, roughly a fifth to a quarter of revenue. Clinic rent is not applied. School figures are not added to PracticePro or QuickBooks payments.' },
  { term: 'Gross wages', basis: 'Pay date. All staff. Not fully loaded.', means: 'Wages already on a payroll file. Employer taxes, benefits, and a split by clinic or school are still missing, so this is not a labor cost for profit.' },
  { term: 'Private cash programs', basis: 'Not loaded.', means: 'Intensive therapy and swim lessons, about 5% of the business. They need their own income report before they can sit beside the clinics.' },
];

type Row = {
  id: string;
  name: string;
  scope: ProfitCenterScope | null;
  overhead: string;
  overheadTitle: string;
  visits: string;
  visitsTitle: string;
};

function clinicRows(snapshot: FinanceSnapshot | null, mode: PeriodMode, month: string, checking: boolean, unavailable: boolean): Row[] {
  return LOCATIONS.map(name => {
    const estimate = !checking && !unavailable && snapshot ? estimatedFixedOverhead(snapshot, mode, month, name) : null;
    const overhead = checking ? 'Checking' : unavailable ? 'Unavailable' : estimate ? money(estimate.value) : 'Not loaded';
    const overheadTitle = checking
      ? 'Checking the overhead budget. No figure is filled in until that check finishes.'
      : unavailable
        ? 'The overhead budget could not be loaded. Nothing is estimated in its place.'
        : estimate
          ? `${estimate.label}. ${estimate.missingCells} workbook cells are still blank and are not treated as zero. Budget, not actual spending.`
          : 'The 2026 overhead workbook is not loaded for this clinic. That file supplies the monthly budget. Missing months are not filled with zero.';
    return {
      id: name,
      name,
      scope: name,
      overhead,
      overheadTitle,
      visits: checking ? 'Checking' : unavailable ? 'Unavailable' : 'Not calculated',
      visitsTitle: checking ? 'Checking. Visits are not estimated while data is loading.' : unavailable ? 'Visits are not estimated while the books are unavailable.' : `${BREAK_EVEN} ${MISSING_VISITS}`,
    };
  });
}

/** Owner comparison. Dollar figures come only from a confirmed overhead budget. Visits and profit stay blank until the files exist. */
export function CheshireOwnerSummary({ snapshot, mode, month, scope, checking, unavailable, onOpenLocation }: {
  snapshot: FinanceSnapshot | null;
  mode: PeriodMode;
  month: string;
  scope: ProfitCenterScope;
  checking: boolean;
  unavailable: boolean;
  onOpenLocation: (scope: ProfitCenterScope) => void;
}) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const clinics = clinicRows(snapshot, mode, month, checking, unavailable);
  const pending = checking ? 'Checking' : unavailable ? 'Unavailable' : null;
  const schools: Row = {
    id: 'schools',
    name: 'Schools',
    scope: 'schools',
    overhead: pending ?? 'Not applied',
    overheadTitle: 'Schools are their own business. Clinic rent and location overhead stay with the clinics and are not charged here.',
    visits: pending ?? 'Not calculated',
    visitsTitle: 'School break-even needs school income, therapist time in schools, and school-only costs. Clinic rent is not part of it.',
  };
  const cash: Row = {
    id: 'cash',
    name: 'Private cash programs',
    scope: null,
    overhead: pending ?? 'Not loaded',
    overheadTitle: 'Intensive therapy and swim lessons need their own income report. They are not mixed into clinic payments.',
    visits: pending ?? 'Not calculated',
    visitsTitle: 'Cash-program visits need a program income report and the labor that belongs to those programs.',
  };
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    dialogRef.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);
  return <section className="cos" aria-label="Clinic comparison">
    <div className="cos-head">
      <h2>Where each part of the business stands</h2>
      <button type="button" className="cos-define" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>What these numbers mean</button>
    </div>
    <p className="cos-lead">Overhead appears only when the 2026 budget workbook is loaded. Profit, break-even visits, and visits to hit a margin stay blank until visits and fully loaded payroll are in the same month. Nothing on this page is filled in with a guess.</p>
    <p className="cos-trend">A month-to-month line will appear after the same kind of report is saved for two or more months. No trend is drawn from a guess.</p>
    <div className="cos-table" role="table" aria-label="Overhead and visits by profit center">
      <div className="cos-columns" role="row">
        <span role="columnheader">Profit center</span>
        <span role="columnheader">Overhead budget</span>
        <span role="columnheader">Visits to break even</span>
        <span role="columnheader">Visits for a margin</span>
      </div>
      {clinics.map(row => <ScoreRow key={row.id} row={row} pressed={scope === row.scope} onOpen={onOpenLocation}/>)}
      <ScoreRow row={schools} pressed={scope === 'schools'} onOpen={onOpenLocation}/>
      <div className="cos-static" role="row">
        <span className="cos-name" role="rowheader">{cash.name}</span>
        <Cell label="Overhead budget" value={cash.overhead} title={cash.overheadTitle}/>
        <Cell label="Visits to break even" value={cash.visits} title={cash.visitsTitle}/>
        <Cell label="Visits for a margin" value={cash.visits} title={MARGIN_VISITS}/>
      </div>
    </div>
    <p className="cos-formula">Break-even visits = {BREAK_EVEN} {MISSING_VISITS}</p>
    {open ? <div className="cos-backdrop" onMouseDown={() => setOpen(false)}>
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="cos-dialog" tabIndex={-1} ref={dialogRef} onMouseDown={event => event.stopPropagation()}>
        <div className="cos-dialog-bar">
          <h2 id={titleId}>What these numbers mean</h2>
          <button type="button" className="cos-close" onClick={() => setOpen(false)}>Close</button>
        </div>
        <dl>
          {DEFINITIONS.map(item => <div key={item.term}>
            <dt>{item.term}</dt>
            <dd><span>Basis: {item.basis}</span>{item.means}</dd>
          </div>)}
        </dl>
      </div>
    </div> : null}
  </section>;
}

function ScoreRow({ row, pressed, onOpen }: { row: Row; pressed: boolean; onOpen: (scope: ProfitCenterScope) => void }) {
  if (!row.scope) return null;
  const scope = row.scope;
  return <button type="button" className="cos-row" role="row" aria-pressed={pressed} onClick={() => onOpen(scope)}>
    <span className="cos-name" role="rowheader">{row.name}</span>
    <Cell label="Overhead budget" value={row.overhead} title={row.overheadTitle}/>
    <Cell label="Visits to break even" value={row.visits} title={row.visitsTitle}/>
    <Cell label="Visits for a margin" value={row.visits} title={MARGIN_VISITS}/>
  </button>;
}

function Cell({ label, value, title }: { label: string; value: string; title: string }) {
  return <span className="cos-cell" role="cell" title={title}>
    <span className="cos-cell-label">{label}</span>
    <span className={value.startsWith('$') ? 'cos-figure' : 'cos-blank'}>{value}</span>
  </span>;
}
