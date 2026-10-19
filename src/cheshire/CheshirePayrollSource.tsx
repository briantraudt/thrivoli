import { formatPayrollSourceAmount, payrollDateLabel, type PayrollSourceSummary } from './payrollSourceAudit';
import './payroll-source.css';

export function CheshirePayrollSource({ summary, onReviewSource }: { summary: PayrollSourceSummary | null; onReviewSource?: () => void }) {
  if (!summary) return null;
  const { audit, months } = summary;
  const currencyLabel = audit.currency === null ? 'Currency unconfirmed' : `Source currency: ${audit.currency}`;
  return <section className="cpa-source" aria-labelledby="cpa-title">
    <div className="cpa-headline">
      <div><p className="cpa-eyebrow">Retained payroll source · all staff</p><h2 id="cpa-title">Observed gross wages</h2><p>Pay-date source subtotal · {months.length}/{summary.requestedMonthCount} selected months reported</p></div>
      <div className="cpa-amount"><strong>{formatPayrollSourceAmount(summary.grossHundredths)}</strong><span>{currencyLabel}</span></div>
    </div>
    <p className="cpa-warning">Partial source wages only. Fully loaded labor and profit still need data. Employer taxes, employer-paid benefits, earned periods and approved therapist/location allocations remain unresolved. Gross already includes any reported bonuses.</p>
    <details className="cpa-monthly"><summary>Monthly gross wages by pay date</summary>
      <div className="cpa-table-wrap"><table><caption>Observed amounts in the selected period. Missing months are not zero; pay-date totals do not establish full-month coverage.</caption><thead><tr><th scope="col">Pay month</th><th scope="col">Gross wages</th><th scope="col">Source rows</th></tr></thead>
        <tbody>{months.map(row => <tr key={row.month}><th scope="row">{new Date(`${row.month}-01T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })}{row.month === audit.firstPayDate.slice(0, 7) ? <small>First observed pay date: {payrollDateLabel(audit.firstPayDate)}</small> : null}{row.month === audit.lastPayDate.slice(0, 7) ? <small>Last observed pay date: {payrollDateLabel(audit.lastPayDate)}</small> : null}</th><td>{formatPayrollSourceAmount(row.grossHundredths)}</td><td>{row.rows.toLocaleString('en-US')}</td></tr>)}</tbody>
        <tfoot><tr><th scope="row">Selected source subtotal</th><td>{formatPayrollSourceAmount(summary.grossHundredths)}</td><td>{months.reduce((sum, row) => sum + row.rows, 0).toLocaleString('en-US')}</td></tr></tfoot>
      </table></div>
      <p>{currencyLabel}. The full retained export spans {payrollDateLabel(audit.firstPayDate)} to {payrollDateLabel(audit.lastPayDate)} and contains {audit.detailRows.toLocaleString('en-US')} rows across {audit.staffCount.toLocaleString('en-US')} staff IDs. Employee identities and pay-disbursement fields are excluded from this view.</p>
      <p>Only aggregate audit data is retained in this dashboard. The original workbook remains in private Library; individual payroll rows have not been imported here.</p>
      <a href="#csd-source-review" onClick={onReviewSource}>Review payroll source and missing data</a>
    </details>
  </section>;
}
