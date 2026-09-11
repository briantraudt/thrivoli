import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { NavLink, Navigate, useLocation, useNavigate } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { cheshireSupabase } from "./lib/cheshireSupabase";
import "./cheshire-portal.css";

type AuthState =
  "checking" | "signed-out" | "checking-access" | "authorized" | "denied";

const cheshireDataSources = [
  {
    name: "Therapist stats workbook",
    cadence: "Weekly",
    status: "complete",
    fields: [
      "Therapist and discipline",
      "Week-ending date",
      "Hours worked and travel",
      "Visit and unit targets",
      "Clinic visits and units",
      "School hours",
      "Productivity percentage",
      "Monthly and quarterly totals",
    ],
  },
  {
    name: "Therapist Daily Summary",
    cadence: "Weekly",
    status: "complete",
    fields: [
      "Therapist",
      "Service date",
      "Location",
      "Service type",
      "Visits",
      "Units",
      "Cancellations or no-shows",
    ],
  },
  {
    name: "Summation by Provider",
    cadence: "Monthly",
    status: "complete",
    fields: [
      "Treating provider",
      "Location",
      "Service date",
      "Units",
      "Charge amount",
      "Insurance payments",
      "Patient payments",
      "Write-offs",
      "Outstanding balance",
    ],
  },
  {
    name: "Payment Summary",
    cadence: "Monthly",
    status: "complete",
    fields: [
      "Treating provider",
      "Reporting period",
      "Insurance payments",
      "Patient payments",
      "Total payments",
    ],
  },
  {
    name: "Detailed payment export",
    cadence: "Monthly",
    status: "needed",
    fields: [
      "Payment date",
      "Service date",
      "Therapist",
      "Location",
      "Payer",
      "Service or CPT code",
      "Insurance payment",
      "Patient payment",
      "Adjustments and write-offs",
      "Claim balance",
    ],
  },
  {
    name: "School billing workbook",
    cadence: "Monthly",
    status: "complete",
    fields: [
      "Therapist",
      "School or district",
      "Service date",
      "Service category",
      "Billed hours or visits",
      "Travel or admin time",
      "Contract rate",
      "Invoice period and total",
    ],
  },
  {
    name: "Bonus calculations",
    cadence: "Monthly / quarterly",
    status: "complete",
    fields: [
      "Therapist",
      "Bonus period",
      "Target",
      "Actual result",
      "Qualification status",
      "Monthly payout",
      "Quarterly payout",
      "Paid date",
    ],
  },
  {
    name: "School contract rates",
    cadence: "Annually / on change",
    status: "partial",
    fields: [
      "School or district",
      "Effective dates",
      "Discipline and service",
      "Hourly or per-visit method",
      "Reimbursement rate",
      "Minimums or caps",
      "Travel and administrative terms",
    ],
  },
  {
    name: "Employment costs",
    cadence: "Monthly / on change",
    status: "needed",
    fields: [
      "Therapist",
      "Location allocation",
      "Salary or hourly wage",
      "FTE or paid hours",
      "Payroll taxes",
      "Benefits",
      "Paid time off",
      "Bonuses",
      "Effective dates",
    ],
  },
  {
    name: "Operating expenses",
    cadence: "Monthly",
    status: "needed",
    fields: [
      "Location or central department",
      "Accounting month",
      "Expense category",
      "Amount",
      "Vendor",
      "Direct or shared classification",
      "Allocation rule",
      "Recurring or one-time",
    ],
  },
] as const;

export function CheshireLogin() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    cheshireSupabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate("/cheshire/dashboard", { replace: true });
    });
  }, [navigate]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setMessage("");
    const normalizedEmail = email.trim().toLowerCase();
    const { error: authError } =
      mode === "signin"
        ? await cheshireSupabase.auth.signInWithPassword({
            email: normalizedEmail,
            password,
          })
        : await cheshireSupabase.auth.signUp({
            email: normalizedEmail,
            password,
            options: {
              emailRedirectTo: `${window.location.origin}/cheshire/dashboard`,
            },
          });
    setSubmitting(false);
    if (authError) {
      setError(
        mode === "signin"
          ? "Check your email and password and try again."
          : authError.message,
      );
      return;
    }
    if (mode === "signup") {
      setMessage("Check your email to confirm your account.");
      setPassword("");
      return;
    }
    navigate("/cheshire/dashboard", { replace: true });
  };

  return (
    <main className="cfz-login-page">
      <section className="cfz-login-card">
        <div className="cfz-login-brand">
          <span>t</span>
          <strong>thrivoli</strong>
        </div>
        <p>Cheshire Fitness Zone</p>
        <div
          className="cfz-auth-tabs"
          role="tablist"
          aria-label="Account access"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === "signin"}
            className={mode === "signin" ? "active" : ""}
            onClick={() => {
              setMode("signin");
              setError("");
              setMessage("");
            }}
          >
            Sign in
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "signup"}
            className={mode === "signup" ? "active" : ""}
            onClick={() => {
              setMode("signup");
              setError("");
              setMessage("");
            }}
          >
            Create account
          </button>
        </div>
        <h1>{mode === "signin" ? "Sign in" : "Create account"}</h1>
        <form onSubmit={submit}>
          <label>
            Email address
            <input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label>
            Password
            <input
              type="password"
              minLength={8}
              autoComplete={
                mode === "signin" ? "current-password" : "new-password"
              }
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          {error && (
            <div className="cfz-auth-error" role="alert">
              {error}
            </div>
          )}
          {message && (
            <div className="cfz-auth-message" role="status">
              {message}
            </div>
          )}
          <button type="submit" disabled={submitting}>
            {submitting
              ? "Please wait…"
              : mode === "signin"
                ? "Sign in"
                : "Create account"}
          </button>
        </form>
      </section>
    </main>
  );
}

export function CheshireProtected({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>("checking");
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    let active = true;
    const authorize = async (nextSession: Session | null) => {
      if (!active) return;
      setSession(nextSession);
      if (!nextSession) {
        setState("signed-out");
        return;
      }
      setState("checking-access");
      const { data, error } = await cheshireSupabase
        .from("cheshire_portal_member")
        .select("email")
        .maybeSingle();
      if (!active) return;
      setState(!error && data ? "authorized" : "denied");
    };
    cheshireSupabase.auth
      .getSession()
      .then(({ data }) => authorize(data.session));
    const { data: listener } = cheshireSupabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        void authorize(nextSession);
      },
    );
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  if (state === "checking" || state === "checking-access")
    return (
      <main className="cfz-gate">
        <div className="cfz-spinner" />
        <p>Opening the secure Cheshire portal…</p>
      </main>
    );
  if (state === "signed-out") return <Navigate to="/cheshire" replace />;
  if (state === "denied")
    return (
      <main className="cfz-gate">
        <h1>Access not authorized</h1>
        <p>{session?.user.email} does not have access to this portal.</p>
        <button
          onClick={() => cheshireSupabase.auth.signOut({ scope: "local" })}
        >
          Return to sign in
        </button>
      </main>
    );
  return <>{children}</>;
}

export function CheshireShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const signOut = async () => {
    await cheshireSupabase.auth.signOut({ scope: "local" });
    navigate("/cheshire", { replace: true });
  };
  return (
    <div className="cfz-shell">
      <aside className="cfz-sidebar">
        <NavLink to="/cheshire/dashboard" className="cfz-sidebar-title">
          Cheshire
        </NavLink>
        <nav className="cfz-nav" aria-label="Cheshire portal">
          <NavLink to="/cheshire/dashboard">Dashboard</NavLink>
          <NavLink to="/cheshire/map">Profitability map</NavLink>
        </nav>
        <section
          className="cfz-source-tracker"
          aria-labelledby="cfz-source-title"
        >
          <header>
            <div>
              <span id="cfz-source-title">Data sources</span>
              <small>6 of 10 complete</small>
            </div>
            <b>60%</b>
          </header>
          <div className="cfz-source-progress" aria-hidden="true">
            <i />
          </div>
          <div className="cfz-source-items">
            {cheshireDataSources.map((source) => {
              const sourceId = `source-${source.name.replaceAll(" ", "-").toLowerCase()}`;
              return (
                <div
                  className={`cfz-source-item ${source.status}`}
                  key={source.name}
                >
                  <button type="button" aria-describedby={sourceId}>
                    <i aria-hidden="true" />
                    <span>
                      <strong>{source.name}</strong>
                      <small>{source.cadence}</small>
                    </span>
                  </button>
                  <div
                    className="cfz-source-detail"
                    role="tooltip"
                    id={sourceId}
                  >
                    <header>
                      <strong>{source.name}</strong>
                      <span>{source.status}</span>
                    </header>
                    <small>Required information</small>
                    <ul>
                      {source.fields.map((field) => (
                        <li key={field}>{field}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            })}
          </div>
          <p>Hover or focus to view requirements.</p>
        </section>
        <div className="cfz-sidebar-footer">
          <button onClick={signOut}>Sign out</button>
        </div>
      </aside>
      <div className="cfz-main">{children}</div>
    </div>
  );
}

export function CheshireDashboard() {
  const locationRows = [
    {
      name: "Cheshire",
      visits: 118,
      units: 362,
      payments: "$10,793.41",
      share: 69.7,
    },
    { name: "Pool", visits: 34, units: 84, payments: "$2,883.05", share: 18.6 },
    {
      name: "Meriden",
      visits: 37,
      units: 128,
      payments: "$1,801.09*",
      share: 11.6,
    },
  ];
  return (
    <main className="cfz-dashboard">
      <section className="cfz-metrics">
        <article>
          <span>Clinic payments</span>
          <strong>$15,477.55</strong>
          <small>Insurance + patient payments</small>
        </article>
        <article>
          <span>Clinic visits</span>
          <strong>189</strong>
          <small>Across 3 reporting locations</small>
        </article>
        <article>
          <span>School hours</span>
          <strong>171.5</strong>
          <small className="pending">Rate confirmation pending</small>
        </article>
        <article>
          <span>Quarterly productivity</span>
          <strong>111%</strong>
          <small>$500 quarterly bonus earned</small>
        </article>
      </section>
      <section className="cfz-dashboard-grid">
        <article className="cfz-panel">
          <header>
            <div>
              <p className="cfz-eyebrow">Pilot therapist</p>
              <h2>Revenue and activity mix</h2>
            </div>
            <span>Karissa Laramie · OTR/L</span>
          </header>
          <div className="cfz-mix">
            <div className="cfz-donut">
              <span>
                <strong>91%</strong>insurance
              </span>
            </div>
            <div className="cfz-mix-list">
              <div>
                <i className="insurance" />
                <span>
                  <strong>$14,064.11</strong>
                  <small>Insurance payments</small>
                </span>
                <b>91%</b>
              </div>
              <div>
                <i className="patient" />
                <span>
                  <strong>$1,413.44</strong>
                  <small>Patient payments</small>
                </span>
                <b>9%</b>
              </div>
              <div>
                <i className="bonus" />
                <span>
                  <strong>$550.00</strong>
                  <small>Bonus expense</small>
                </span>
                <b>3.6% of payments</b>
              </div>
            </div>
          </div>
          <div className="cfz-unit-strip">
            <div>
              <span>Clinic units billed</span>
              <strong>574</strong>
            </div>
            <div>
              <span>Average units per visit</span>
              <strong>3.04</strong>
            </div>
            <div>
              <span>Payments per visit</span>
              <strong>$81.89</strong>
            </div>
          </div>
        </article>
      </section>
      <section className="cfz-panel cfz-locations">
        <header>
          <div>
            <p className="cfz-eyebrow">Clinic activity</p>
            <h2>Performance by location</h2>
          </div>
          <span>Pilot therapist only</span>
        </header>
        <div className="cfz-table">
          <div className="cfz-row head">
            <span>Location</span>
            <span>Visits</span>
            <span>Units</span>
            <span>Payments</span>
            <span>Share of payments</span>
          </div>
          {locationRows.map((row) => (
            <div className="cfz-row" key={row.name}>
              <strong>{row.name}</strong>
              <span>{row.visits}</span>
              <span>{row.units}</span>
              <span>{row.payments}</span>
              <span>
                <i style={{ width: `${row.share}%` }} />
                {row.share}%
              </span>
            </div>
          ))}
        </div>
        <p className="cfz-note">
          *Meriden payment total is awaiting confirmation from the
          location-level report.
        </p>
      </section>
    </main>
  );
}

export function CheshireMapPage({ children }: { children: ReactNode }) {
  const location = useLocation();
  if (location.pathname !== "/cheshire/map") return null;
  return (
    <div className="cfz-map-page">
      <header>
        <p className="cfz-eyebrow">Operating model</p>
        <h1>Profitability map</h1>
        <p>
          How revenue, labor, operating expenses, and shared overhead connect
          across the business.
        </p>
      </header>
      {children}
    </div>
  );
}
