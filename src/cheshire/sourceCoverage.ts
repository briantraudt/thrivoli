/** Compact observed coverage. A missing month is never silently treated as zero. */
export function monthName(month: string, includeYear = true): string {
  return new Date(`${month}-01T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', ...(includeYear ? { year: 'numeric' as const } : {}), timeZone: 'UTC' });
}
export function monthEnd(month: string): string {
  const [year, number] = month.split('-').map(Number);
  return new Date(Date.UTC(year, number, 0)).toISOString().slice(0, 10);
}
export function coverageLabels(requested: readonly string[], observed: readonly string[], options: { through?: string; failed?: readonly string[]; partial?: readonly string[]; combined?: boolean } = {}): string {
  const present = [...new Set(observed.filter(month => requested.includes(month)))].sort();
  const failed = options.failed ?? [];
  const year = new Set(requested.map(month => month.slice(0, 4))).size > 1;
  const label = (month: string) => monthName(month, year);
  const through = options.through && present.includes(options.through.slice(0, 7)) ? options.through : present.at(-1) ? monthName(present.at(-1)!) : null;
  return [
    through ? `Current through ${through}` : '',
    ...requested.filter(month => !present.includes(month)).map(month => `${failed.includes(month) ? 'Unavailable' : 'Missing'} ${label(month)}`),
    ...(options.partial ?? []).filter(month => present.includes(month)).map(month => `${label(month)} partial`),
    options.combined ? 'July/August combined' : '',
  ].filter(Boolean).join(' · ');
}
