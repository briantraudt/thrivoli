/** Private provider display names are data, never repository fixtures or verified payroll links. */
export type TherapistRosterRow = {
  id: string;
  displayName: string;
  payrollCandidateName: string | null;
  matchStatus: 'candidate_full_name' | 'candidate_first_surname' | 'candidate_alias' | 'no_payroll_candidate' | 'not_applicable';
  entityKind: 'person' | 'resource';
  zipStatus: 'available' | 'candidate' | 'not_found' | 'not_reviewed';
  zipWorkbook: string | null;
  revenueStatus: 'present' | 'absent' | 'not_reviewed';
  paymentStatus: 'present' | 'present_zero' | 'absent' | 'not_reviewed';
};
export type TherapistRoster = {
  sourceHash: string;
  providerPeriod: { start: string; end: string };
  rows: TherapistRosterRow[];
};
type RosterDocument = {
  id: string; source_type: string; source_origin?: string | null; status: string;
  requested_month?: string | null; reported_month?: string | null; storage_path?: string | null;
  content_sha256: string; supersedes_id?: string | null; validation?: object | null;
};
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid roster');
  return value as Record<string, unknown>;
}
function keys(value: Record<string, unknown>, expected: string[]): void {
  if (Object.keys(value).sort().join('|') !== [...expected].sort().join('|')) throw new Error('Unexpected roster fields');
}
function name(value: unknown): string {
  if (typeof value !== 'string' || value !== value.trim() || !value || value.length > 160 || /[<>@]/.test(value) || [...value].some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)) throw new Error('Invalid roster name');
  return value;
}
function date(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Invalid roster period');
  const parsed = new Date(`${value}T12:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw new Error('Invalid roster period');
  return value;
}
export function parseTherapistRoster(value: unknown, sourceHash: string): TherapistRoster {
  const audit = object(value);
  keys(audit, ['version', 'source_sha256', 'provider_period', 'rows']);
  if (typeof audit.version !== 'string' || !['therapist-roster-v1', 'therapist-roster-v2'].includes(String(audit.version)) || !/^[a-f0-9]{64}$/.test(sourceHash) || audit.source_sha256 !== sourceHash) throw new Error('Unverified roster source');
  const v2 = audit.version === 'therapist-roster-v2';
  const period = object(audit.provider_period); keys(period, ['start', 'end']);
  const start = date(period.start), end = date(period.end);
  if (start > end) throw new Error('Invalid roster period');
  if (!Array.isArray(audit.rows) || !audit.rows.length || audit.rows.length > 2000) throw new Error('Invalid roster rows');
  const ids = new Set<string>(), names = new Set<string>();
  const rows = audit.rows.map(value => {
    const row = object(value); keys(row, ['id', 'display_name', 'payroll_candidate_name', 'match_status', ...(v2 ? ['entity_kind', 'zip_status', 'zip_workbook', 'revenue_status', 'payment_status'] : [])]);
    if (typeof row.id !== 'string' || !/^provider_[a-f0-9]{16}$/.test(row.id) || ids.has(row.id)) throw new Error('Invalid roster identity');
    const displayName = name(row.display_name), nameKey = displayName.toLocaleLowerCase('en-US').replace(/\s+/g, ' ');
    if (names.has(nameKey)) throw new Error('Duplicate roster name');
    ids.add(row.id); names.add(nameKey);
    if (typeof row.match_status !== 'string' || ![ 'candidate_full_name', 'candidate_first_surname', 'no_payroll_candidate', ...(v2 ? ['candidate_alias', 'not_applicable'] : [])].includes(row.match_status)) throw new Error('Invalid match status');
    const payrollCandidateName = row.payroll_candidate_name === null ? null : name(row.payroll_candidate_name);
    if (['no_payroll_candidate', 'not_applicable'].includes(row.match_status) !== (payrollCandidateName === null)) throw new Error('Conflicting match status');
    const entityKind = v2 ? row.entity_kind : 'person';
    const zipStatus = v2 ? row.zip_status : 'not_reviewed';
    const revenueStatus = v2 ? row.revenue_status : 'not_reviewed';
    const paymentStatus = v2 ? row.payment_status : 'not_reviewed';
    for (const [value, allowed] of [[entityKind, ['person', 'resource']], [zipStatus, ['available', 'candidate', 'not_found', 'not_reviewed']], [revenueStatus, ['present', 'absent', 'not_reviewed']], [paymentStatus, ['present', 'present_zero', 'absent', 'not_reviewed']]] as const) {
      if (typeof value !== 'string' || !(allowed as readonly string[]).includes(value)) throw new Error('Invalid source evidence');
    }
    const zipWorkbook = !v2 || row.zip_workbook === null ? null : name(row.zip_workbook);
    if (['available', 'candidate'].includes(String(zipStatus)) !== (zipWorkbook !== null)) throw new Error('Conflicting ZIP evidence');
    if ((entityKind === 'resource') !== (row.match_status === 'not_applicable')) throw new Error('Conflicting resource classification');
    return { id: row.id, displayName, payrollCandidateName, matchStatus: row.match_status as TherapistRosterRow['matchStatus'],
      entityKind: entityKind as TherapistRosterRow['entityKind'], zipStatus: zipStatus as TherapistRosterRow['zipStatus'], zipWorkbook,
      revenueStatus: revenueStatus as TherapistRosterRow['revenueStatus'], paymentStatus: paymentStatus as TherapistRosterRow['paymentStatus'] };

  });
  rows.sort((a, b) => a.displayName.localeCompare(b.displayName));
  return { sourceHash, providerPeriod: { start, end }, rows };
}

/** Caller must gate documents on protected finance/intake access before invoking this reader. */
export function readTherapistRoster(documents: readonly RosterDocument[]): { roster: TherapistRoster | null; issue: string | null } {
  const superseded = new Set(documents.map(document => document.supersedes_id).filter(Boolean));
  const candidates = new Map<string, TherapistRoster>();
  let invalid = false;
  for (const document of documents) {
    if (superseded.has(document.id)) continue;
    const validation = document.validation as Record<string, unknown> | null;
    if (!validation?.therapist_roster_audit) continue;
    try {
      if (document.source_type !== 'staff_allocation' || document.source_origin !== 'existing_source' || document.status !== 'incomplete' || document.requested_month !== null || document.reported_month !== null || document.storage_path !== null || validation.validator_version !== 'source-audit-v1' || validation.status !== 'incomplete') throw new Error('Invalid roster envelope');
      const roster = parseTherapistRoster(validation.therapist_roster_audit, document.content_sha256);
      const prior = candidates.get(roster.sourceHash);
      if (prior && JSON.stringify(prior) !== JSON.stringify(roster)) throw new Error('Conflicting roster');
      candidates.set(roster.sourceHash, roster);
    } catch { invalid = true; }
  }
  if (invalid || candidates.size > 1) return { roster: null, issue: 'Roster review required' };
  return { roster: [...candidates.values()][0] ?? null, issue: null };
}
