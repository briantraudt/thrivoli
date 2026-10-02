import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { NavLink, Navigate, useLocation, useNavigate } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { cheshireSupabase } from "./lib/cheshireSupabase";
import { CheshireMonthlyIntakeProvider } from "./cheshire/CheshireMonthlyIntakeProvider";
import { CheshirePortalNavigation } from "./cheshire/CheshirePortalNavigation";
import { createRequestGuard } from "./cheshire/requestGuard";
import "./cheshire-portal.css";
export { CheshireFinanceDashboard as CheshireDashboard } from "./cheshire/CheshireFinanceDashboard";

type AuthState =
  | "checking"
  | "signed-out"
  | "checking-access"
  | "authorized"
  | "denied";

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
  return <CheshireMonthlyIntakeProvider><CheshireShellContent>{children}</CheshireShellContent></CheshireMonthlyIntakeProvider>;
}

function CheshireShellContent({ children }: { children: ReactNode }) {
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
        <CheshirePortalNavigation />
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

