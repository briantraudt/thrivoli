import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { NavLink, Navigate, useLocation, useNavigate } from "react-router-dom";
import { BarChart3, Database, GitBranch, LogOut, ShieldCheck } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { cheshireSupabase } from "./lib/cheshireSupabase";
import "./cheshire-portal.css";

type AuthState = "checking" | "signed-out" | "checking-access" | "authorized" | "denied";

export function CheshireLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    cheshireSupabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate("/cheshire/dashboard", { replace: true });
    });
  }, [navigate]);

  const signIn = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    const { error: authError } = await cheshireSupabase.auth.signInWithPassword({ email: email.trim(), password });
    setSubmitting(false);
    if (authError) {
      setError("We couldn’t sign you in. Check your email and password and try again.");
      return;
    }
    navigate("/cheshire/dashboard", { replace: true });
  };

  return <main className="cfz-login-page">
    <section className="cfz-login-card">
      <div className="cfz-login-brand"><span>CFZ</span><div><strong>Cheshire Fitness Zone</strong><small>Executive intelligence</small></div></div>
      <div className="cfz-lock"><ShieldCheck size={29}/></div>
      <p className="cfz-eyebrow">Secure client portal</p>
      <h1>Welcome back</h1>
      <p>Sign in to view Cheshire’s executive dashboard and profitability model.</p>
      <form onSubmit={signIn}>
        <label>Email address<input type="email" autoComplete="username" required value={email} onChange={(event)=>setEmail(event.target.value)} /></label>
        <label>Password<input type="password" autoComplete="current-password" required value={password} onChange={(event)=>setPassword(event.target.value)} /></label>
        {error && <div className="cfz-auth-error" role="alert">{error}</div>}
        <button type="submit" disabled={submitting}>{submitting ? "Signing in…" : "Sign in"}</button>
      </form>
      <small>Authorized Cheshire Fitness Zone users only</small>
    </section>
  </main>;
}

export function CheshireProtected({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>("checking");
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    let active = true;
    const authorize = async (nextSession: Session | null) => {
      if (!active) return;
      setSession(nextSession);
      if (!nextSession) { setState("signed-out"); return; }
      setState("checking-access");
      const { data, error } = await cheshireSupabase.from("cheshire_portal_member").select("email").maybeSingle();
      if (!active) return;
      setState(!error && data ? "authorized" : "denied");
    };
    cheshireSupabase.auth.getSession().then(({ data }) => authorize(data.session));
    const { data: listener } = cheshireSupabase.auth.onAuthStateChange((_event, nextSession) => { void authorize(nextSession); });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);

  if (state === "checking" || state === "checking-access") return <main className="cfz-gate"><div className="cfz-spinner"/><p>Opening the secure Cheshire portal…</p></main>;
  if (state === "signed-out") return <Navigate to="/cheshire" replace/>;
  if (state === "denied") return <main className="cfz-gate"><ShieldCheck size={34}/><h1>Access not authorized</h1><p>{session?.user.email} is signed in but does not have access to the Cheshire client portal.</p><button onClick={()=>cheshireSupabase.auth.signOut({ scope:"local" })}>Return to sign in</button></main>;
  return <>{children}</>;
}

export function CheshireShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const signOut = async () => { await cheshireSupabase.auth.signOut({ scope:"local" }); navigate("/cheshire", { replace:true }); };
  return <div className="cfz-shell">
    <header className="cfz-header"><NavLink to="/cheshire/dashboard" className="cfz-brand"><span>CFZ</span><div><strong>Cheshire Fitness Zone</strong><small>Executive intelligence</small></div></NavLink><button onClick={signOut}><LogOut size={17}/>Sign out</button></header>
    <nav className="cfz-nav" aria-label="Cheshire portal"><NavLink to="/cheshire/dashboard"><BarChart3 size={18}/>Executive Dashboard</NavLink><NavLink to="/cheshire/map"><GitBranch size={18}/>Profitability Map</NavLink></nav>
    {children}
    <footer className="cfz-footer"><span>Cheshire Fitness Zone</span><span>Confidential client portal</span></footer>
  </div>;
}

export function CheshireDashboard() {
  const locationRows=[
    {name:"Cheshire",visits:118,units:362,payments:"$10,793.41",share:69.7},
    {name:"Pool",visits:34,units:84,payments:"$2,883.05",share:18.6},
    {name:"Meriden",visits:37,units:128,payments:"$1,801.09*",share:11.6},
  ];
  return <main className="cfz-dashboard">
    <header className="cfz-page-heading"><div><p className="cfz-eyebrow">Executive dashboard</p><h1>Business performance</h1><p>A single view of revenue, profitability, capacity, and data readiness across Cheshire Fitness Zone.</p></div><div className="cfz-period"><span>Reporting period</span><strong>Mar 7 – May 23, 2026</strong></div></header>
    <aside className="cfz-coverage"><Database size={18}/><div><strong>Pilot data is active</strong><span>Current results reflect Karissa Laramie’s validated pilot dataset. Company-wide totals will populate as source connections are added.</span></div><b>Partial coverage</b></aside>
    <section className="cfz-metrics">
      <article><span>Clinic payments</span><strong>$15,477.55</strong><small>Insurance + patient payments</small></article>
      <article><span>Clinic visits</span><strong>189</strong><small>Across 3 reporting locations</small></article>
      <article><span>School hours</span><strong>171.5</strong><small className="pending">Rate confirmation pending</small></article>
      <article><span>Quarterly productivity</span><strong>111%</strong><small>$500 quarterly bonus earned</small></article>
    </section>
    <section className="cfz-dashboard-grid">
      <article className="cfz-panel"><header><div><p className="cfz-eyebrow">Pilot therapist</p><h2>Revenue and activity mix</h2></div><span>Karissa Laramie · OTR/L</span></header><div className="cfz-mix"><div className="cfz-donut"><span><strong>91%</strong>insurance</span></div><div className="cfz-mix-list"><div><i className="insurance"/><span><strong>$14,064.11</strong><small>Insurance payments</small></span><b>91%</b></div><div><i className="patient"/><span><strong>$1,413.44</strong><small>Patient payments</small></span><b>9%</b></div><div><i className="bonus"/><span><strong>$550.00</strong><small>Bonus expense</small></span><b>3.6% of payments</b></div></div></div><div className="cfz-unit-strip"><div><span>Clinic units billed</span><strong>574</strong></div><div><span>Average units per visit</span><strong>3.04</strong></div><div><span>Payments per visit</span><strong>$81.89</strong></div></div></article>
      <article className="cfz-panel cfz-readiness"><header><div><p className="cfz-eyebrow">Implementation</p><h2>Data readiness</h2></div><b>4 of 6 sources</b></header><div className="cfz-source-list">{[["Therapist statistics",100],["Clinic payments",92],["School billing",80],["Bonus calculations",100],["Employment cost",12],["Contract rates",12]].map(([name,value])=><div key={String(name)}><span>{name}</span><i><b style={{width:`${value}%`}}/></i><strong>{value}%</strong></div>)}</div><div className="cfz-needed"><strong>Needed for profitability</strong><span>School contract reimbursement rate</span><span>Therapist wages, taxes, and benefits</span></div></article>
    </section>
    <section className="cfz-panel cfz-locations"><header><div><p className="cfz-eyebrow">Clinic activity</p><h2>Performance by location</h2></div><span>Pilot therapist only</span></header><div className="cfz-table"><div className="cfz-row head"><span>Location</span><span>Visits</span><span>Units</span><span>Payments</span><span>Share of payments</span></div>{locationRows.map(row=><div className="cfz-row" key={row.name}><strong>{row.name}</strong><span>{row.visits}</span><span>{row.units}</span><span>{row.payments}</span><span><i style={{width:`${row.share}%`}}/>{row.share}%</span></div>)}</div><p className="cfz-note">*Meriden payment total is awaiting confirmation from the location-level report.</p></section>
  </main>;
}

export function CheshireMapPage({ children }: { children: ReactNode }) {
  const location=useLocation();
  if(location.pathname!=="/cheshire/map") return null;
  return <div className="cfz-map-page"><header><p className="cfz-eyebrow">Operating model</p><h1>Profitability map</h1><p>How revenue, labor, operating expenses, and shared overhead connect across the business.</p></header>{children}</div>;
}
