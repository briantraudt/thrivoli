import { CheshireMonthlyChecklist, CheshireMonthlyIntakeReview } from './CheshireMonthlyIntake';
import { useIntake } from './intakeContext';
import type { FinanceSnapshot } from './finance';
import type { FinanceLoadState } from './CheshireFinanceDashboardView';

/** Operational upload/review controls stay separate from the numeric dashboard. */
export function CheshireSourceReview({ snapshot, state }: { snapshot: FinanceSnapshot | null; state: FinanceLoadState }) {
  const intake = useIntake();
  if (!['ready', 'empty'].includes(state) || intake.state !== 'ready') return <main className="cfd-dashboard"><h1>Data requests</h1><span role="status">{state === 'no-access' || intake.state === 'no-access' ? 'Access required' : state === 'error' || intake.state === 'unavailable' ? 'Source unavailable' : 'Loading'}</span></main>;
  return <main className="cfd-dashboard"><h1>Data requests</h1><label>Month <input type="month" aria-label="Source review month" value={intake.month} onChange={event => intake.setMonth(event.target.value)}/></label><CheshireMonthlyChecklist/><CheshireMonthlyIntakeReview snapshot={snapshot}/></main>;
}
