/** Entirely fictional values. No customer identities, identifiers, hashes or amounts. */
export function payrollAuditFixture() {
  return {
    version: 'payroll-private-audit-v1',
    provenance: { sha256: 'a'.repeat(64), currency: null, actual_pay_dates: ['2026-01-09', '2026-03-06'] },
    detail_rows: 6, staff_count: 2,
    reconciliation: { gross_pay: { detail_sum: '600.00', source_control: '600.00', difference: '0.00', blank_rows: 0 } },
    pay_date_month_summaries: {
      '2026-01': { rows: 2, staff_ids: 2, gross_pay: '100.00' },
      '2026-02': { rows: 2, staff_ids: 2, gross_pay: '200.00' },
      '2026-03': { rows: 2, staff_ids: 2, gross_pay: '300.00' },
    },
  };
}
export function payrollDocumentFixture() {
  return {
    id: 'fictional-payroll-document', source_type: 'payroll', content_sha256: 'a'.repeat(64),
    status: 'incomplete', source_origin: 'existing_source', requested_month: null, reported_month: null,
    storage_path: null, file_name: 'Fictional payroll export.xlsx', created_at: '2026-03-10T00:00:00Z',
    validation: { validator_version: 'source-audit-v1', status: 'incomplete', reported_month: null,
      checks: [], missing_items: ['Fictional missing employer costs'], covered_locations: [], canonical_fields: [],
      payroll_source_audit: payrollAuditFixture(),
    },
  };
}
