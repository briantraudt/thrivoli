import { useMemo, useState } from "react";
import { NavLink, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import {
  Bell, BookOpen, Building2, CalendarDays, ChevronLeft, ChevronRight, ClipboardCheck,
  DollarSign, HeartPulse, Menu, MessageSquare, Package, Plus, Search, Settings,
  ShieldCheck, Sparkles, Users, WalletCards, X
} from "lucide-react";
import { screenByPath, screens } from "./data";
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
