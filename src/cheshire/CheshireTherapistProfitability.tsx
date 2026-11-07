import type { TherapistRoster, TherapistRosterRow } from './therapistRoster';
import './therapist-roster.css';

function ProviderRow({ row }: { row: TherapistRosterRow }) {
  const resource = row.entityKind === 'resource';
  const reviewed = row.matchStatus === 'reviewed_name_discipline';
  const evidence = (status: string) => status === 'present' ? 'Source record present' : status === 'present_zero' ? 'Source record present · $0' : status === 'absent' ? 'No source row found' : 'Not reviewed';
  return <li className="ctr-provider">
    <h3>{row.displayName}</h3>
    <dl className="ctr-links">
      {resource ? <div><dt>Type</dt><dd>Resource label · not a verified therapist</dd></div> : <>
        <div><dt>{reviewed ? 'Reviewed payroll name' : 'Payroll candidate'}</dt><dd>{row.payrollCandidateName ?? 'No name candidate found'}</dd></div>
        <div><dt>Payroll link</dt><dd>{reviewed ? 'Reviewed match · name + clinical discipline' : row.reviewIssue === 'discipline_conflict' ? 'Name match · source discipline needs review' : row.matchStatus === 'no_payroll_candidate' ? 'No name candidate · not proof of missing payroll' : row.matchStatus === 'candidate_alias' ? 'Possible alias · unconfirmed' : 'Unverified name candidate'}</dd></div>
        {reviewed && row.identityReview ? <div><dt>Identity review</dt><dd>{row.identityReview.reviewDate} · stable-ID link not verified</dd></div> : null}
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

/** Source presence and reviewed identities never establish individual profitability. */
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
  const reviewed = people.filter(row => row.matchStatus === 'reviewed_name_discipline').length;
  const aliases = people.filter(row => row.matchStatus === 'candidate_alias').length;
  const disciplineConflicts = people.filter(row => row.reviewIssue === 'discipline_conflict').length;
  return <section id="therapist-profitability" tabIndex={-1} className="ced-board ctr-board" aria-label="Therapist profitability">
    <div className="ced-board-head"><h2>Therapist profitability</h2></div>
    {!safeRoster ? <dl className="ctr-links">
      <div><dt>Revenue/payroll link</dt><dd>{sourceState ?? issue ?? 'Match not verified'}</dd></div>
      <div><dt>Therapist labor</dt><dd>{sourceState ?? issue ?? 'Allocation missing'}</dd></div>
      <div><dt>Therapist profit</dt><dd>{sourceState ?? issue ?? 'Missing matched revenue + labor'}</dd></div>
    </dl> : <>
      <div className="ced-category-badges">
        <small className="ced-category-badge">Observed company-wide roster · {safeRoster.providerPeriod.start}–{safeRoster.providerPeriod.end}</small>
        <small className="ced-category-badge">{reviewed} reviewed payroll matches</small>
        <small className="ced-category-badge">{people.length - noCandidate - reviewed} unconfirmed payroll candidates</small>
        {disciplineConflicts ? <small className="ced-category-badge">{disciplineConflicts} source-discipline exceptions</small> : null}
        {aliases ? <small className="ced-category-badge">{aliases} possible aliases</small> : null}
        <small className="ced-category-badge">{noCandidate} without a payroll name candidate</small>
      </div>
      {selectedId !== 'all' ? selected ? <ul className="ctr-providers"><ProviderRow row={selected}/></ul>
        : <span role="status">Selected therapist is not in this roster</span>
        : <>
          <details className="ctr-details"><summary>View source coverage and payroll links ({people.length} therapists)</summary>
            <ul className="ctr-providers">{people.map(row => <ProviderRow key={row.id} row={row}/>)}</ul>
          </details>
          {resources.length ? <details className="ctr-details"><summary>Resource labels ({resources.length})</summary>
            <ul className="ctr-providers">{resources.map(row => <ProviderRow key={row.id} row={row}/>)}</ul>
          </details> : null}
        </>}
    </>}
  </section>;
}
