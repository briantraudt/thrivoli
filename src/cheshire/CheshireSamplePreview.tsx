import { useState } from 'react';
import { IntakeContext, type IntakeContextValue } from './intakeContext';
import { CheshireFinanceDashboardView } from './CheshireFinanceDashboardView';
import { CATEGORIES, LOCATIONS, parseFinanceSnapshot } from './finance';
import '../cheshire-portal.css';

const SAMPLE_BANNER = 'Sample data — not your clinics. These figures are a labeled example so the layout can be reviewed. They are not Cheshire’s books.';

const snapshot = parseFinanceSnapshot({
  source_name: 'Sample overhead workbook',
  cadence: 'monthly',
  cost_basis: 'fixed_monthly_baseline',
  basis_note: 'Sample monthly budget used only to show the layout.',
  basis_confirmed_at: '2026-10-02T00:00:00Z',
  effective_month: null,
  imported_at: '2026-10-02T00:00:00Z',
  overhead_rows: LOCATIONS.flatMap((location, index) => CATEGORIES.map((category, row) => ({
    location, category, sourceCell: `${String.fromCharCode(68 + index)}${row + 5}`, amount: '100.00',
  }))),
});

/** Development-only layout preview. Production builds do not import this module. */
export default function CheshireSamplePreview() {
  const [month, setMonth] = useState('2026-10');
  const value: IntakeContextValue = {
    month, setMonth, selected: 'coverage_manifest', setSelected: () => {}, documents: [], referenceSnapshot: snapshot,
    setReferenceSnapshot: () => {}, state: 'ready', aiEnabled: false, mappingEnabled: false,
    suggestReportType: async () => ({ source_types: [], ai_status: 'unavailable' }), message: '', busy: false,
    refresh: () => {}, upload: async () => false, review: async () => {},
  };
  return <div className="cfz-shell">
    <aside className="cfz-sidebar">
      <p className="cfz-sidebar-title">Cheshire</p>
      <p>Sample layout for review. Nothing here is signed in, and nothing here is a clinic’s books.</p>
    </aside>
    <div className="cfz-main">
      <IntakeContext.Provider value={value}>
        <CheshireFinanceDashboardView snapshot={snapshot} state="ready" onRefresh={() => {}} sampleBanner={SAMPLE_BANNER} sampleParts={{
          clinic: { cents: 1_250_000, basis: 'Sample clinic payments', partial: false },
          schools: { cents: 400_000, basis: 'Sample school invoices', partial: false },
          cash: { cents: 75_000, basis: 'Sample cash programs', partial: false },
        }}/>
      </IntakeContext.Provider>
    </div>
  </div>;
}
