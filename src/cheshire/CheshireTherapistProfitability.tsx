import type { TherapistRoster, TherapistRosterRow } from './therapistRoster';
import './therapist-roster.css';

function ProviderRow({ row }: { row: TherapistRosterRow }) {
  const resource = row.entityKind === 'resource';
  const evidence = (status: string) => status === 'present' ? 'Source record present' : status === 'present_zero' ? 'Source record present · $0' : status === 'absent' ? 'No source row found' : 'Not reviewed';
  return <li className="ctr-provider">
    <h3>{row.displayName}</h3>
    <dl className="ctr-links">
      {resource ? <div><dt>Type</dt><dd>Resource label · not a verified therapist</dd></div> : <>
        <div><dt>Payroll candidate</dt><dd>{row.payrollCandidateName ?? 'No name candidate found'}</dd></div>
        <div><dt>Payroll link</dt><dd>{row.matchStatus === 'no_payroll_candidate' ? 'No name candidate · not proof of missing payroll' : row.matchStatus === 'candidate_alias' ? 'Possible alias · unconfirmed' : 'Unverified name candidate'}</dd></div>
        <div><dt>Therapist ZIP</dt><dd>{row.zipStatus === 'candidate' ? `${row.zipWorkbook} · owner unconfirmed` : row.zipStatus === 'available' ? row.zipWorkbook : row.zipStatus === 'not_found' ? 'No corresponding named workbook found' : 'Not reviewed'}</dd></div>
      </>}
      <div><dt>Provider revenue</dt><dd>{evidence(row.revenueStatus)}</dd></div>
      <div><dt>Posted payments</dt><dd>{evidence(row.paymentStatus)}</dd></div>
      {!resource ? <>
        <div><dt>Revenue/payroll allocation</dt><dd>Not verified</dd></div>
        <div><dt>Labor allocation</dt><dd>Missing</dd></div>
        <div><dt>Profit</dt><dd aria-label="Profit unavailable">—</dd></div>
      </> : null}
    </dl>
  </li>;
}

/** Source presence and provisional names never establish individual profitability. */
export function CheshireTherapistProfitability({ roster, selectedId, sourceState = null, issue = null }: {
  roster: TherapistRoster | null;
  selectedId: string;
  sourceState?: string | null;
  issue?: string | null;
}) {
  const safeRoster = sourceState || issue ? null : roster;
  const people = safeRoster?.rows.filter(row => row.entityKind !== 'resource') ?? [];
  const resources = safeRoster?.rows.filter(row => row.entityKind === 'resource') ?? [];
  const selected = people.find(row => row.id === selectedId);
  const noCandidate = people.filter(row => row.matchStatus === 'no_payroll_candidate').length;
  const aliases = people.filter(row => row.matchStatus === 'candidate_alias').length;
  return <section id="therapist-profitability" tabIndex={-1} className="ced-board ctr-board" aria-label="Therapist profitability">
    <div className="ced-board-head"><h2>Therapist profitability</h2></div>
    {!safeRoster ? <dl className="ctr-links">
      <div><dt>Revenue/payroll link</dt><dd>{sourceState ?? issue ?? 'Match not verified'}</dd></div>
      <div><dt>Therapist labor</dt><dd>{sourceState ?? issue ?? 'Allocation missing'}</dd></div>
      <div><dt>Therapist profit</dt><dd>{sourceState ?? issue ?? 'Missing matched revenue + labor'}</dd></div>
    </dl> : <>
      <div className="ced-category-badges">
        <small className="ced-category-badge">Observed company-wide roster · {safeRoster.providerPeriod.start}–{safeRoster.providerPeriod.end}</small>
        <small className="ced-category-badge">{people.length - noCandidate} unverified payroll candidates</small>
        {aliases ? <small className="ced-category-badge">{aliases} possible aliases</small> : null}
        <small className="ced-category-badge">{noCandidate} without a payroll name candidate</small>
      </div>
      {selectedId !== 'all' ? selected ? <ul className="ctr-providers"><ProviderRow row={selected}/></ul>
        : <span role="status">Selected therapist is not in this roster</span>
        : <>
          <details className="ctr-details"><summary>View source coverage and unconfirmed links ({people.length} therapists)</summary>
            <ul className="ctr-providers">{people.map(row => <ProviderRow key={row.id} row={row}/>)}</ul>
          </details>
          {resources.length ? <details className="ctr-details"><summary>Resource labels ({resources.length})</summary>
            <ul className="ctr-providers">{resources.map(row => <ProviderRow key={row.id} row={row}/>)}</ul>
          </details> : null}
        </>}
    </>}
  </section>;
}
