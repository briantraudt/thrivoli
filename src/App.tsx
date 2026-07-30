import { useMemo, useState } from "react";
import { NavLink, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import {
  Bell, BookOpen, Building2, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, ClipboardCheck,
  DollarSign, HeartPulse, Menu, MessageSquare, Package, Plus, Search, Settings,
  ShieldCheck, Sparkles, TrendingUp, Users, WalletCards, X
} from "lucide-react";
import { screenByPath, screens } from "./data";
import { StediEligibility } from "./stedi-eligibility";
import type { Metric, ScreenDefinition, Tone } from "./types";

const nav = [
  { label: "Run the day", items: [
    ["Overview", "/", Sparkles], ["Schedule", "/schedule", CalendarDays], ["Patients", "/patients", HeartPulse],
    ["Work queue", "/tasks", ClipboardCheck], ["Team", "/team", Users],
  ]},
  { label: "Money", items: [
    ["Billing & claims", "/billing", WalletCards], ["Reimbursements", "/reimbursements", DollarSign],
    ["Payers", "/payers", Building2], ["Financials", "/financials", BookOpen], ["Accounting", "/accounting", WalletCards],
  ]},
  { label: "Grow", items: [
    ["Referrals & intake", "/referrals", Plus], ["Growth engine", "/growth", Sparkles],
    ["Referring providers", "/referring-providers", Users],
  ]},
  { label: "Operations", items: [
    ["Locations", "/locations", Building2], ["Schools & districts", "/schools", BookOpen],
    ["Inventory", "/inventory", Package], ["Compliance", "/compliance", ShieldCheck],
  ]},
] as const;

const toneLabel: Record<Tone, string> = {
  positive: "On track", attention: "Needs action", warning: "At risk",
  error: "Blocking", info: "Information", neutral: "Open",
};

function Status({ tone = "neutral", label }: { tone?: Tone; label?: string }) {
  return <span className={`status status-${tone}`}><i />{label ?? toneLabel[tone]}</span>;
}

function Kpis({ metrics }: { metrics: Metric[] }) {
  return <section className="card kpis" aria-label="Key performance indicators">
    {metrics.map((metric) => <div className="kpi" key={metric.label}>
      <span>{metric.label}</span>
      <strong className={`text-${metric.tone ?? "neutral"}`}>{metric.value}</strong>
      <small>{metric.detail}</small>
    </div>)}
  </section>;
}

type LocationPerformanceRow = {
  id: string;
  name: string;
  visits: number;
  breakEven: number;
  projected: number;
  priorMonth: number;
  businessDaysElapsed: number;
  businessDaysTotal: number;
  netRevenuePerVisit: number;
  laborCost: number;
  operatingCost: number;
  payerMix: { label: string; value: number; revenue: string }[];
  weeklyVisits: { week: string; visits: number; target: number; cancellations: number; noShows: number }[];
  disciplines: { name: string; visits: number; utilization: number; openSlots: number }[];
  actions: string[];
};

const locationPerformance: LocationPerformanceRow[] = [
  {
    id: "cheshire", name: "Cheshire", visits: 870, breakEven: 550, projected: 1_080, priorMonth: 998,
    businessDaysElapsed: 17, businessDaysTotal: 22, netRevenuePerVisit: 126, laborCost: 69_400, operatingCost: 18_900,
    payerMix: [{ label: "Insurance", value: 74, revenue: "$81,100" }, { label: "School contracts", value: 20, revenue: "$21,900" }, { label: "Cash programs", value: 6, revenue: "$6,600" }],
    weeklyVisits: [{ week: "Jul 1–5", visits: 198, target: 125, cancellations: 14, noShows: 7 }, { week: "Jul 6–12", visits: 257, target: 175, cancellations: 17, noShows: 9 }, { week: "Jul 13–19", visits: 273, target: 175, cancellations: 13, noShows: 6 }, { week: "Jul 20–MTD", visits: 142, target: 75, cancellations: 8, noShows: 4 }],
    disciplines: [{ name: "Physical therapy", visits: 348, utilization: 91, openSlots: 14 }, { name: "Occupational therapy", visits: 287, utilization: 88, openSlots: 19 }, { name: "Speech therapy", visits: 235, utilization: 86, openSlots: 22 }],
    actions: ["Protect the current staffing plan; demand supports the scheduled hours.", "Fill 22 open speech-therapy slots from the waitlist before adding overtime.", "Review eight authorizations expiring in the next 14 days to protect projected volume."],
  },
  {
    id: "meriden", name: "Meriden", visits: 784, breakEven: 540, projected: 972, priorMonth: 906,
    businessDaysElapsed: 17, businessDaysTotal: 22, netRevenuePerVisit: 123, laborCost: 63_800, operatingCost: 17_600,
    payerMix: [{ label: "Insurance", value: 76, revenue: "$73,300" }, { label: "School contracts", value: 19, revenue: "$18,300" }, { label: "Cash programs", value: 5, revenue: "$4,800" }],
    weeklyVisits: [{ week: "Jul 1–5", visits: 176, target: 123, cancellations: 15, noShows: 8 }, { week: "Jul 6–12", visits: 231, target: 172, cancellations: 16, noShows: 9 }, { week: "Jul 13–19", visits: 242, target: 172, cancellations: 14, noShows: 7 }, { week: "Jul 20–MTD", visits: 135, target: 73, cancellations: 9, noShows: 4 }],
    disciplines: [{ name: "Physical therapy", visits: 314, utilization: 89, openSlots: 18 }, { name: "Occupational therapy", visits: 259, utilization: 86, openSlots: 24 }, { name: "Speech therapy", visits: 211, utilization: 84, openSlots: 27 }],
    actions: ["Keep hiring paused until the remaining open capacity is consistently filled.", "Move qualified waitlist patients into the 27 open speech-therapy slots.", "Investigate Tuesday afternoon cancellations, which account for 31% of lost visits."],
  },
  {
    id: "orange", name: "Orange", visits: 756, breakEven: 510, projected: 936, priorMonth: 881,
    businessDaysElapsed: 17, businessDaysTotal: 22, netRevenuePerVisit: 125, laborCost: 61_200, operatingCost: 16_400,
    payerMix: [{ label: "Insurance", value: 72, revenue: "$68,000" }, { label: "School contracts", value: 23, revenue: "$21,700" }, { label: "Cash programs", value: 5, revenue: "$4,700" }],
    weeklyVisits: [{ week: "Jul 1–5", visits: 171, target: 116, cancellations: 12, noShows: 6 }, { week: "Jul 6–12", visits: 224, target: 162, cancellations: 14, noShows: 8 }, { week: "Jul 13–19", visits: 232, target: 162, cancellations: 13, noShows: 7 }, { week: "Jul 20–MTD", visits: 129, target: 70, cancellations: 7, noShows: 4 }],
    disciplines: [{ name: "Physical therapy", visits: 302, utilization: 90, openSlots: 16 }, { name: "Occupational therapy", visits: 257, utilization: 87, openSlots: 21 }, { name: "Speech therapy", visits: 197, utilization: 82, openSlots: 31 }],
    actions: ["Maintain current clinician coverage; the clinic is producing a healthy contribution margin.", "Use the school-contract schedule to fill midday clinic capacity.", "Target speech referrals before approving additional PT hours."],
  },
  {
    id: "guilford", name: "Guilford", visits: 651, breakEven: 430, projected: 806, priorMonth: 768,
    businessDaysElapsed: 17, businessDaysTotal: 22, netRevenuePerVisit: 128, laborCost: 53_600, operatingCost: 14_700,
    payerMix: [{ label: "Insurance", value: 70, revenue: "$58,300" }, { label: "School contracts", value: 25, revenue: "$20,800" }, { label: "Cash programs", value: 5, revenue: "$4,200" }],
    weeklyVisits: [{ week: "Jul 1–5", visits: 147, target: 98, cancellations: 11, noShows: 5 }, { week: "Jul 6–12", visits: 192, target: 137, cancellations: 12, noShows: 6 }, { week: "Jul 13–19", visits: 201, target: 137, cancellations: 10, noShows: 5 }, { week: "Jul 20–MTD", visits: 111, target: 58, cancellations: 6, noShows: 3 }],
    disciplines: [{ name: "Physical therapy", visits: 267, utilization: 89, openSlots: 13 }, { name: "Occupational therapy", visits: 214, utilization: 85, openSlots: 20 }, { name: "Speech therapy", visits: 170, utilization: 81, openSlots: 29 }],
    actions: ["Preserve the current school-to-clinic staffing split.", "Backfill speech openings before expanding the cash-program calendar.", "Review the three largest payer underpayments in the reimbursement queue."],
  },
  {
    id: "torrington", name: "Torrington", visits: 603, breakEven: 460, projected: 746, priorMonth: 701,
    businessDaysElapsed: 17, businessDaysTotal: 22, netRevenuePerVisit: 121, laborCost: 49_900, operatingCost: 15_100,
    payerMix: [{ label: "Insurance", value: 77, revenue: "$56,200" }, { label: "School contracts", value: 18, revenue: "$13,100" }, { label: "Cash programs", value: 5, revenue: "$3,700" }],
    weeklyVisits: [{ week: "Jul 1–5", visits: 135, target: 105, cancellations: 14, noShows: 7 }, { week: "Jul 6–12", visits: 178, target: 146, cancellations: 15, noShows: 8 }, { week: "Jul 13–19", visits: 187, target: 146, cancellations: 13, noShows: 7 }, { week: "Jul 20–MTD", visits: 103, target: 63, cancellations: 8, noShows: 4 }],
    disciplines: [{ name: "Physical therapy", visits: 253, utilization: 86, openSlots: 22 }, { name: "Occupational therapy", visits: 194, utilization: 82, openSlots: 28 }, { name: "Speech therapy", visits: 156, utilization: 78, openSlots: 36 }],
    actions: ["Close the 36 open speech slots before increasing clinician hours.", "Call patients with recurring no-shows and offer standing alternative times.", "Validate that the lower reimbursement per visit is payer mix—not a posting delay."],
  },
  {
    id: "pool", name: "Pool Location", visits: 418, breakEven: 500, projected: 517, priorMonth: 492,
    businessDaysElapsed: 17, businessDaysTotal: 22, netRevenuePerVisit: 116, laborCost: 42_800, operatingCost: 14_900,
    payerMix: [{ label: "Insurance", value: 54, revenue: "$26,200" }, { label: "School contracts", value: 16, revenue: "$7,800" }, { label: "Cash programs", value: 30, revenue: "$14,600" }],
    weeklyVisits: [{ week: "Jul 1–5", visits: 94, target: 114, cancellations: 18, noShows: 5 }, { week: "Jul 6–12", visits: 123, target: 159, cancellations: 22, noShows: 7 }, { week: "Jul 13–19", visits: 131, target: 159, cancellations: 19, noShows: 6 }, { week: "Jul 20–MTD", visits: 70, target: 68, cancellations: 11, noShows: 3 }],
    disciplines: [{ name: "Aquatic physical therapy", visits: 246, utilization: 72, openSlots: 54 }, { name: "Intensive programs", visits: 88, utilization: 68, openSlots: 19 }, { name: "Swim lessons", visits: 84, utilization: 75, openSlots: 28 }],
    actions: ["The clinic needs 82 more visits this month to reach break-even.", "Launch a same-week fill list for weather-related and late cancellations.", "Bundle unused intensive-program capacity into the next cash campaign."],
  },
  {
    id: "new-location", name: "New Location", visits: 164, breakEven: 460, projected: 203, priorMonth: 0,
    businessDaysElapsed: 17, businessDaysTotal: 22, netRevenuePerVisit: 119, laborCost: 38_600, operatingCost: 16_100,
    payerMix: [{ label: "Insurance", value: 81, revenue: "$15,800" }, { label: "School contracts", value: 14, revenue: "$2,700" }, { label: "Cash programs", value: 5, revenue: "$1,000" }],
    weeklyVisits: [{ week: "Jul 1–5", visits: 21, target: 105, cancellations: 5, noShows: 2 }, { week: "Jul 6–12", visits: 45, target: 146, cancellations: 7, noShows: 3 }, { week: "Jul 13–19", visits: 61, target: 146, cancellations: 8, noShows: 4 }, { week: "Jul 20–MTD", visits: 37, target: 63, cancellations: 4, noShows: 2 }],
    disciplines: [{ name: "Physical therapy", visits: 71, utilization: 38, openSlots: 84 }, { name: "Occupational therapy", visits: 55, utilization: 34, openSlots: 78 }, { name: "Speech therapy", visits: 38, utilization: 29, openSlots: 72 }],
    actions: ["Ramp plan is 296 visits behind break-even; do not add fixed labor yet.", "Prioritize referral conversion and move overflow evaluations from nearby clinics.", "Review the launch budget weekly until projected visits exceed 75% of break-even."],
  },
];

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const number = new Intl.NumberFormat("en-US");

function LocationPerformance() {
  const [selectedId, setSelectedId] = useState(locationPerformance[0].id);
  const selected = locationPerformance.find((location) => location.id === selectedId) ?? locationPerformance[0];
  const maxVisits = Math.max(...locationPerformance.flatMap((location) => [location.visits, location.breakEven]));
  const variance = selected.visits - selected.breakEven;
  const variancePercent = Math.round((variance / selected.breakEven) * 100);
  const visitsPerDay = selected.visits / selected.businessDaysElapsed;
  const breakEvenPace = selected.breakEven / selected.businessDaysTotal;
  const remainingDays = selected.businessDaysTotal - selected.businessDaysElapsed;
  const visitsNeeded = Math.max(selected.breakEven - selected.visits, 0);
  const dailyNeed = remainingDays > 0 ? visitsNeeded / remainingDays : 0;
  const revenue = selected.visits * selected.netRevenuePerVisit;
  const contribution = revenue - selected.laborCost - selected.operatingCost;
  const utilization = Math.round(selected.disciplines.reduce((sum, item) => sum + item.utilization, 0) / selected.disciplines.length);
  const lostVisits = selected.weeklyVisits.reduce((sum, week) => sum + week.cancellations + week.noShows, 0);
  const totalVisits = locationPerformance.reduce((sum, location) => sum + location.visits, 0);
  const totalBreakEven = locationPerformance.reduce((sum, location) => sum + location.breakEven, 0);

  return <section className="card location-performance" aria-labelledby="location-performance-title">
    <div className="performance-heading">
      <div>
        <span className="eyebrow">Operating performance</span>
        <h2 id="location-performance-title">Location performance</h2>
        <p>Month-to-date visits versus break-even. Select a clinic to inspect the operational and financial drivers.</p>
      </div>
      <div className="performance-legend" aria-label="Chart legend"><span><i className="legend-performance" />Performance</span><span><i className="legend-break-even" />Break-even</span></div>
    </div>

    <div className="location-bars">
      {locationPerformance.map((location) => {
        const isSelected = location.id === selected.id;
        const ratio = location.visits / location.breakEven;
        const tone = ratio >= 1 ? "positive" : ratio >= .75 ? "warning" : "error";
        return <button
          type="button"
          className={`location-bar-row ${isSelected ? "selected" : ""}`}
          aria-expanded={isSelected}
          aria-controls="location-drilldown"
          onClick={() => setSelectedId(location.id)}
          key={location.id}
        >
          <strong>{location.name}</strong>
          <span className="bar-track" aria-hidden="true">
            <span className="break-even-bar" style={{ width: `${(location.breakEven / maxVisits) * 100}%` }} />
            <span className={`performance-bar performance-${tone}`} style={{ width: `${(location.visits / maxVisits) * 100}%` }} />
          </span>
          <span className="bar-value"><b>{number.format(location.visits)}</b><em>/</em>{number.format(location.breakEven)}<ChevronDown size={15} /></span>
        </button>;
      })}
    </div>

    <div className="performance-total">
      <span><strong>{number.format(totalVisits)}</strong> visits delivered vs <strong>{number.format(totalBreakEven)}</strong> break-even</span>
      <span><strong>22%</strong> school contracts · <strong>5%</strong> cash programs · <strong>73%</strong> insurance</span>
    </div>

    <div className="location-drilldown" id="location-drilldown">
      <div className="drilldown-title">
        <div><span className="eyebrow">Selected clinic</span><h3>{selected.name}</h3></div>
        <Status tone={variance >= 0 ? "positive" : variancePercent >= -25 ? "warning" : "error"} label={variance >= 0 ? `${number.format(variance)} visits above break-even` : `${number.format(Math.abs(variance))} visits below break-even`} />
      </div>

      <div className="drilldown-kpis">
        <div><span>MTD visits</span><strong>{number.format(selected.visits)}</strong><small>{visitsPerDay.toFixed(1)} per business day</small></div>
        <div><span>Month-end projection</span><strong>{number.format(selected.projected)}</strong><small>{selected.priorMonth ? `${number.format(selected.projected - selected.priorMonth)} vs prior month` : "First operating month"}</small></div>
        <div><span>Break-even requirement</span><strong>{number.format(selected.breakEven)}</strong><small>{visitsNeeded ? `${number.format(visitsNeeded)} still needed · ${dailyNeed.toFixed(1)}/day` : `${number.format(variance)} visit cushion`}</small></div>
        <div><span>Net revenue / visit</span><strong>{currency.format(selected.netRevenuePerVisit)}</strong><small>{currency.format(revenue)} estimated MTD revenue</small></div>
        <div><span>Contribution after costs</span><strong className={contribution >= 0 ? "text-positive" : "text-error"}>{currency.format(contribution)}</strong><small>{currency.format(selected.laborCost)} labor · {currency.format(selected.operatingCost)} operating</small></div>
        <div><span>Capacity utilization</span><strong>{utilization}%</strong><small>{lostVisits} visits lost to cancels/no-shows</small></div>
      </div>

      <div className="driver-grid">
        <section className="driver-panel">
          <div className="driver-heading"><div><span className="eyebrow">Volume trend</span><h4>Weekly visit detail</h4></div><span className={visitsPerDay >= breakEvenPace ? "trend-good" : "trend-bad"}><TrendingUp size={14} />{visitsPerDay.toFixed(1)} vs {breakEvenPace.toFixed(1)} needed/day</span></div>
          <div className="detail-table-wrap"><table className="detail-table"><thead><tr><th>Week</th><th>Visits</th><th>Target</th><th>Cancel</th><th>No-show</th></tr></thead><tbody>{selected.weeklyVisits.map((week) => <tr key={week.week}><td>{week.week}</td><td>{week.visits}</td><td>{week.target}</td><td>{week.cancellations}</td><td>{week.noShows}</td></tr>)}</tbody></table></div>
        </section>

        <section className="driver-panel">
          <span className="eyebrow">Revenue composition</span><h4>Payer and program mix</h4>
          <div className="mix-list">{selected.payerMix.map((mix) => <div key={mix.label}><span><b>{mix.label}</b><small>{mix.revenue} estimated revenue</small></span><strong>{mix.value}%</strong><i><span style={{ width: `${mix.value}%` }} /></i></div>)}</div>
        </section>

        <section className="driver-panel">
          <span className="eyebrow">Clinical capacity</span><h4>Visits and open capacity by discipline</h4>
          <div className="discipline-list">{selected.disciplines.map((discipline) => <div key={discipline.name}><span><b>{discipline.name}</b><small>{discipline.visits} visits · {discipline.openSlots} open slots</small></span><strong>{discipline.utilization}%</strong></div>)}</div>
        </section>

        <section className="driver-panel action-panel">
          <span className="eyebrow">Management focus</span><h4>Recommended actions</h4>
          <ol>{selected.actions.map((action) => <li key={action}>{action}</li>)}</ol>
        </section>
      </div>
      <p className="data-note">Figures are aggregated for management reporting and exclude patient-level PHI. Revenue is estimated from posted visits and the clinic's net revenue per visit; final accounting results may differ.</p>
    </div>
  </section>;
}

function AppTable({ screen, query }: { screen: ScreenDefinition; query: string }) {
  const filtered = screen.rows.filter((row) => row.join(" ").toLowerCase().includes(query.toLowerCase()));
  return <div className="table-wrap">
    <table>
      <thead><tr>{screen.columns.map((column) => <th key={column}>{column}</th>)}</tr></thead>
      <tbody>{filtered.map((row, index) => <tr key={`${row[0]}-${index}`}>
        {row.map((cell, cellIndex) => <td key={cellIndex}>
          {cellIndex === 3 ? <Status tone={cell.includes("Blocking") ? "error" : cell.includes("risk") || cell.includes("soon") ? "warning" : cell.includes("Available") ? "positive" : "attention"} label={cell} /> : cell}
        </td>)}
      </tr>)}</tbody>
    </table>
    {!filtered.length && <div className="empty">No work matches “{query}”.</div>}
  </div>;
}

function ContractRail({ path }: { path: string }) {
  const steps = [
    ["/schools/contracts/new/term", "District & term"],
    ["/schools/contracts/new/rates", "Rate card"],
    ["/schools/contracts/new/staffing", "Staffing"],
    ["/schools/contracts/new/invoicing", "Invoicing"],
    ["/schools/contracts/new/review", "Review & send"],
  ];
  if (!path.startsWith("/schools/contracts/new")) return null;
  const current = steps.findIndex(([stepPath]) => stepPath === path);
  return <nav className="card step-rail" aria-label="Contract steps">
    {steps.map(([stepPath, label], index) => <NavLink className={index < current ? "complete" : ""} to={stepPath} key={stepPath}>
      <span>{index + 1}</span>{label}
    </NavLink>)}
  </nav>;
}

function Screen({ screen, openConfirm }: { screen: ScreenDefinition; openConfirm: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [basis, setBasis] = useState("Accrual");
  const parentPath = location.pathname.split("/").slice(0, -1).join("/") || "/";
  const isDetail = location.pathname.split("/").filter(Boolean).length > 1;
  return <>
    <header className="page-header">
      <div>
        {isDetail && <button className="back" onClick={() => screenByPath.has(parentPath) ? navigate(parentPath) : navigate(-1)}><ChevronLeft size={15}/> Back</button>}
        <span className="eyebrow">{screen.eyebrow}</span>
        <h1>{screen.title}</h1>
      </div>
      <div className="header-actions">
        <button className="secondary">Export</button>
        <button className="primary" onClick={openConfirm}><Plus size={15}/>{screen.action}</button>
      </div>
    </header>
    <main>
      <ContractRail path={location.pathname} />
      {screen.id === "statements" && <div className="segment" role="group" aria-label="Accounting basis">
        {["Accrual", "Cash"].map((item) => <button className={basis === item ? "active" : ""} onClick={() => setBasis(item)} key={item}>{item}</button>)}
      </div>}
      <Kpis metrics={screen.metrics} />
      {screen.id === "dashboard" && <LocationPerformance />}
      {screen.id === "auths" && <StediEligibility />}
      <div className="two-column">
        <section className="card work-card">
          <div className="card-title-row">
            <div><span className="eyebrow">Prioritized work</span><h2>What needs attention</h2></div>
            <label className="search-field"><Search size={15}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter this view" /></label>
          </div>
          <AppTable screen={screen} query={query} />
        </section>
        <aside>
          <section className="card">
            <span className="eyebrow">Why this matters</span>
            <h2>Protect care and cash</h2>
            <p>{screen.insight}</p>
          </section>
          <section className="card status-list">
            <div><Status tone="error" label="Blocking" /><strong>$7,490</strong></div>
            <div><Status tone="attention" label="Needs action" /><strong>$12,840</strong></div>
            <div><Status tone="warning" label="At risk" /><strong>$38,600</strong></div>
            <div><Status tone="positive" label="On track" /><strong>91%</strong></div>
          </section>
        </aside>
      </div>
    </main>
  </>;
}

function Shell() {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileNav, setMobileNav] = useState(false);
  const [toast, setToast] = useState("");
  const [confirm, setConfirm] = useState(false);
  const screen = useMemo(() => screenByPath.get(location.pathname) ?? screens[0], [location.pathname]);

  const complete = () => {
    setConfirm(false);
    setToast(`${screen.action} completed. The affected work queue has been updated.`);
    window.setTimeout(() => setToast(""), 3600);
  };

  return <div className="app-shell">
    <button className="mobile-menu" onClick={() => setMobileNav(true)} aria-label="Open navigation"><Menu/></button>
    <aside className={`sidebar ${mobileNav ? "open" : ""}`}>
      <div className="brand" onClick={() => navigate("/")}><span>t</span>thrivoli</div>
      <button className="close-nav" onClick={() => setMobileNav(false)} aria-label="Close navigation"><X/></button>
      <nav>
        {nav.map((group) => <div className="nav-group" key={group.label}>
          <label>{group.label}</label>
          {group.items.map(([label, path, Icon]) => <NavLink onClick={() => setMobileNav(false)} to={path} key={path} className={({isActive}) => isActive ? "active" : ""}>
            <Icon size={16} strokeWidth={1.8}/><span>{label}</span>{label === "Work queue" && <b>23</b>}
          </NavLink>)}
        </div>)}
      </nav>
      <div className="sidebar-tools">
        <NavLink to="/search"><Search size={16}/>Search</NavLink>
        <NavLink to="/messages/THR-204"><MessageSquare size={16}/>Messages</NavLink>
        <NavLink to="/notifications"><Bell size={16}/>Notifications<b>4</b></NavLink>
        <NavLink to="/settings"><Settings size={16}/>Settings</NavLink>
      </div>
      <NavLink className="user-chip" to="/profile"><span>AC</span><div><strong>Amy Cahill</strong><small>Owner · All locations</small></div><ChevronRight size={15}/></NavLink>
    </aside>
    {mobileNav && <div className="scrim" onClick={() => setMobileNav(false)} />}
    <div className="content"><Screen screen={screen} openConfirm={() => setConfirm(true)} /></div>
    {confirm && <div className="dialog-backdrop" onMouseDown={() => setConfirm(false)}>
      <section className="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title" onMouseDown={(event) => event.stopPropagation()}>
        <h2 id="dialog-title">{screen.action}?</h2>
        <p>This updates the live workflow and records the decision in the audit trail. Review the financial and clinical consequence before continuing.</p>
        <div><button className="secondary" onClick={() => setConfirm(false)}>Cancel</button><button className="primary" onClick={complete}>{screen.action}</button></div>
      </section>
    </div>}
    {toast && <div className="toast" role="status">{toast}</div>}
  </div>;
}

export default function App() {
  return <Routes>
    {screens.map((screen) => <Route path={screen.path} element={<Shell/>} key={screen.id}/>)}
    <Route path="*" element={<Shell/>}/>
  </Routes>;
}
