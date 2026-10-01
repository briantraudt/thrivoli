import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { NavLink, Navigate, useLocation, useNavigate } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { cheshireSupabase } from "./lib/cheshireSupabase";
import { createRequestGuard } from "./cheshire/requestGuard";
import "./cheshire-portal.css";
export { CheshireFinanceDashboard as CheshireDashboard } from "./cheshire/CheshireFinanceDashboard";

type AuthState =
  | "checking"
  | "signed-out"
  | "checking-access"
  | "authorized"
  | "denied";

const cheshireDataSources = [
  {
    name: "Therapist stats workbook",
    cadence: "Weekly",
    status: "received",
    fields: [
      "Therapist and discipline",
      "Week-ending date",
      "Hours worked and travel",
      "Visit and unit targets",
      "Clinic visits and units",
      "School hours",
      "Productivity percentage",
      "Daily, weekly, monthly, quarterly, and annual totals",
    ],
  },
  {
    name: "Therapist Daily Summary",
    cadence: "Weekly",
    status: "received",
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
    status: "received",
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
    status: "received",
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
      "Financial trend period",
      "Codes billed",
      "Average reimbursement",
      "Charge summary",
    ],
  },
  {
    name: "Appointment & facility reports",
    cadence: "Weekly / monthly",
    status: "needed",
    fields: [
      "Service date",
      "Location or facility",
      "Therapist and discipline",
      "Appointments scheduled",
      "Completed visits",
      "Cancellations and no-shows",
      "Available capacity",
      "Facility summary",
      "Therapist summary",
    ],
  },
  {
    name: "School billing workbook",
    cadence: "Monthly",
    status: "received",
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
    status: "received",
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
      "Employee role or department",
      "Location allocation",
      "Salary or hourly wage",
      "FTE or paid hours",
      "Payroll taxes",
      "Benefits",
      "Paid time off",
      "Bonuses",
      "Effective dates",
      "Office, billing, and authorization allocation",
    ],
  },
  {
    name: "Operating expense reconciliation",
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
      "Budget or forecast amount",
      "Growth and scenario assumptions",
      "Planned staffing and capacity",
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
    const requests = createRequestGuard();
    const authorize = (nextSession: Session | null) => {
      if (!active) return;
      const version = requests.begin();
      setSession(nextSession);
      if (!nextSession) {
        setState("signed-out");
        return;
      }
      setState("checking-access");
      const checkAccess = async () => {
        if (!active || !requests.isCurrent(version)) return;
        try {
          const { data, error } = await cheshireSupabase
            .from("cheshire_portal_member")
            .select("email")
            .maybeSingle();
          if (!active || !requests.isCurrent(version)) return;
          setState(!error && data ? "authorized" : "denied");
        } catch {
          if (active && requests.isCurrent(version)) setState("denied");
        }
      };
      // Keep Supabase queries outside its synchronous auth callback.
      setTimeout(() => {
        void checkAccess();
      }, 0);
    };
    cheshireSupabase.auth.getSession().then(({ data }) => {
      if (!requests.hasStarted()) void authorize(data.session);
    });
    const { data: listener } = cheshireSupabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        void authorize(nextSession);
      },
    );
    return () => {
      active = false;
      requests.invalidate();
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
              <small>Source requirements</small>
            </div>
            <b>BI</b>
          </header>

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
          <p>
            Received files still need validation and connection. Hover or focus
            for requirements.
          </p>
        </section>
        <div className="cfz-sidebar-footer">
          <button onClick={signOut}>Sign out</button>
        </div>
      </aside>
      <div className="cfz-main">{children}</div>
    </div>
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
