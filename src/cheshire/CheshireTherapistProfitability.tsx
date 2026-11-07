import type { TherapistRoster, TherapistRosterRow } from './therapistRoster';
import './therapist-roster.css';

function ProviderRow({ row }: { row: TherapistRosterRow }) {
  return <li className="ctr-provider">
    <h3>{row.displayName}</h3>
    <dl className="ctr-links">
      <div><dt>Payroll candidate</dt><dd>{row.payrollCandidateName ?? 'No candidate found'}</dd></div>
      <div><dt>Match</dt><dd>{row.matchStatus === 'no_payroll_candidate' ? 'Missing payroll link' : 'Unverified candidate'}</dd></div>
      <div><dt>Revenue allocation</dt><dd>Not verified</dd></div>
      <div><dt>Labor allocation</dt><dd>Missing</dd></div>
      <div><dt>Profit</dt><dd aria-label="Profit unavailable">—</dd></div>
    </dl>
  </li>;
}

/** A provisional name candidate never supplies financial attribution or an individual profit. */
export function CheshireTherapistProfitability({ roster, selectedId, sourceState = null, issue = null }: {
  roster: TherapistRoster | null;
  selectedId: string;
  sourceState?: string | null;
  issue?: string | null;
}) {
  const safeRoster = sourceState || issue ? null : roster;
  const selected = safeRoster?.rows.find(row => row.id === selectedId);
  const noCandidate = safeRoster?.rows.filter(row => row.matchStatus === 'no_payroll_candidate').length ?? 0;
  return <section id="therapist-profitability" tabIndex={-1} className="ced-board ctr-board" aria-label="Therapist profitability">
    <div className="ced-board-head"><h2>Therapist profitability</h2></div>
    {!safeRoster ? <dl className="ctr-links">
      <div><dt>Revenue ↔ therapist</dt><dd>{sourceState ?? issue ?? 'Match not verified'}</dd></div>
      <div><dt>Therapist labor</dt><dd>{sourceState ?? issue ?? 'Allocation missing'}</dd></div>
      <div><dt>Therapist profit</dt><dd>{sourceState ?? issue ?? 'Missing matched revenue + labor'}</dd></div>
    </dl> : <>
      <div className="ced-category-badges">
        <small className="ced-category-badge">Observed company-wide roster · {safeRoster.providerPeriod.start}–{safeRoster.providerPeriod.end}</small>
        <small className="ced-category-badge">{safeRoster.rows.length - noCandidate} unverified payroll candidates</small>
        <small className="ced-category-badge">{noCandidate} missing payroll links</small>
      </div>
      {selectedId !== 'all' ? selected ? <ul className="ctr-providers"><ProviderRow row={selected}/></ul>
        : <span role="status">Selected therapist is not in this roster</span>
        : <details className="ctr-details"><summary>View missing links by therapist ({safeRoster.rows.length})</summary>
          <ul className="ctr-providers">{safeRoster.rows.map(row => <ProviderRow key={row.id} row={row}/>)}</ul>
        </details>}
    </>}
  </section>;
}
