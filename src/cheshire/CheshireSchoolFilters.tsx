import { School, UsersRound } from 'lucide-react';
import type { SchoolFilterOption } from './schoolFilters';

export function CheshireSchoolFilters({ options, value, onChange }: {
  options: SchoolFilterOption[]; value: string; onChange: (value: string) => void;
}) {
  return <div className="csd-school-filters" role="group" aria-label="School and therapist filters">
    <label className="csd-school-filter"><School size={16} aria-hidden="true"/><span className="cps-sr-only">School</span>
      <select aria-label="School" value={value} disabled={!options.length} onChange={event => onChange(event.target.value)}>
        <option value="all">{options.length ? 'All schools' : 'School data unavailable'}</option>
        {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
    <label className="csd-school-filter csd-therapist-filter"><UsersRound size={16} aria-hidden="true"/><span className="cps-sr-only">Therapist</span>
      <select aria-label="Therapist" aria-describedby="csd-school-filter-help" value="unavailable" disabled><option value="unavailable">Therapist data needed</option></select>
    </label>
  </div>;
}
