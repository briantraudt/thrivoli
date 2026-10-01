import { useValidatedMetrics } from './useValidatedMetrics';
import { CheshireValidatedMetrics } from './CheshireValidatedMetrics';
import { formatMetric } from './metrics';
import { useState } from "react";
import { CheshireMonthlyIntakeReview } from "./CheshireMonthlyIntake";
import {
  ArrowDown,
  ArrowUpRight,
  Building2,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Layers3,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { amountToCents } from "./overhead";
import {
  CATEGORIES,
  financeSummary,
  LABOR_ROLES,
  LOCATIONS,
  money,
  type FinanceSnapshot,
} from "./finance";
import "./finance-dashboard.css";

export type FinanceLoadState =
  | "loading"
  | "ready"
  | "no-access"
  | "empty"
  | "error";
type Tab = "locations" | "costs" | "people";

/** Source-backed dashboard; test fixtures stay outside the production bundle. */
export function CheshireFinanceDashboardView({
  snapshot,
  state,
  onRefresh,
}: {
  snapshot: FinanceSnapshot | null;
  state: FinanceLoadState;
  onRefresh: () => void;
}) {
  const [location, setLocation] = useState("all");
  const validatedMetrics = useValidatedMetrics(location);
  const loadedPayroll = validatedMetrics.data?.sources.find(source=>source.source_type==='payroll')?.metrics.find(metric=>metric.key==='loaded_payroll');
  const [tab, setTab] = useState<Tab>("locations");
  const [detail, setDetail] = useState<string | null>(null);
  const summary = snapshot ? financeSummary(snapshot, location) : null;
  const total = snapshot ? financeSummary(snapshot) : null;
  const selectedLocations = LOCATIONS.filter(
    (name) => location === "all" || name === location,
  );
  const period = snapshot?.costBasis === "fixed_monthly_baseline" ? "Fixed monthly baseline" : snapshot?.effectiveMonth
    ? new Date(`${snapshot.effectiveMonth}T12:00:00Z`).toLocaleDateString(
        "en-US",
        { month: "long", year: "numeric", timeZone: "UTC" },
      )
    : "Month to confirm";
  const statusMessage =
    state === "no-access"
      ? "Financial access has not been enabled for this account."
      : state === "empty"
        ? "Your financial workspace is ready. The first verified source has not been imported."
        : state === "error"
          ? "The protected financial source is unavailable. No cached or estimated values are being displayed."
          : state === "loading"
            ? "Loading your protected financial source…"
            : null;
  const maxLocation = Math.max(
    1,
    ...Object.values(total?.byLocation ?? {}).map((row) => row.knownCents),
  );
  const categories = CATEGORIES.map((category) => {
    const rows = summary?.rows.filter((row) => row.category === category) ?? [];
    return {
      category,
      known: rows.reduce(
        (n, row) => n + (row.amount === null ? 0 : amountToCents(row.amount)),
        0,
      ),
      missing: rows.filter((row) => row.amount === null).length,
      count: rows.length,
    };
  }).sort((a, b) => b.known - a.known);
  const maxCategory = Math.max(1, ...categories.map((item) => item.known));

  return (
    <main className="cfd-dashboard">
      <div className="cfd-topline">
        <span>
          <span className="cfd-live-dot" /> Cheshire Fitness Zone
        </span>
        <span>
          <ShieldCheck size={14} /> Private financial workspace
        </span>
      </div>
      <header className="cfd-heading">
        <div>
          <p className="cfd-eyebrow">BUSINESS INTELLIGENCE</p>
          <h1>
            Cheshire performance
          </h1>
          <p>Monthly costs and reporting readiness across seven locations.</p>
        </div>
        <div className="cfd-review-note">
          <CalendarDays size={19} />
          <div>
            <strong>Your weekly business review</strong>
            <span>Monthly economics · source-backed reporting</span>
          </div>
        </div>
      </header>

      <section className="cfd-controls" aria-label="Report filters">
        <label>
          <span>LOCATION</span>
          <div>
            <Building2 size={16} />
            <select
              aria-label="Location"
              value={location}
              onChange={(event) => {
                setLocation(event.target.value);
                setDetail(null);
              }}
            >
              <option value="all">All 7 locations</option>
              {LOCATIONS.map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
            <ChevronDown size={14} />
          </div>
        </label>
        <div className="cfd-period">
          <span>COST REPORTING BASIS</span>
          <strong>
            <CalendarDays size={16} /> {period}
          </strong>
        </div>
        <div className="cfd-basis">
          <span className="cfd-badge">Monthly cost basis</span>
          <small>Not prorated into weekly actuals</small>
        </div>
        <button
          className="cfd-refresh"
          onClick={onRefresh}
          disabled={state === "loading"}
        >
          <RefreshCw
            size={15}
            className={state === "loading" ? "cfd-spinning" : ""}
          />
          <span>Refresh</span>
        </button>
      </section>

      {statusMessage ? (
        <div
          className={`cfd-status ${state === "error" ? "error" : ""}`}
          role="status"
        >
          <LockKeyhole size={19} />
          <div>
            <strong>{statusMessage}</strong>
            <p>
              Financial information is available only to approved readers.
              Missing data is never treated as zero.
            </p>
          </div>
        </div>
      ) : null}

      <section className="cfd-kpis" aria-label="Financial overview">
        <article className="cfd-kpi cfd-kpi-primary">
          <div>
            <span>{snapshot?.costBasis === "fixed_monthly_baseline" ? "Known fixed monthly overhead" : "Known monthly overhead"}</span>
            <Wallet size={18} />
          </div>
          <strong>
            {summary && summary.knownCells > 0
              ? money(summary.knownTotalCents)
              : "—"}
          </strong>
          <p>
            {summary
              ? `${summary.knownCells} of ${summary.totalCells} source cells have amounts`
              : "Waiting for the protected source"}
          </p>
          <footer>
            <span className="cfd-dot" />
            {summary
              ? `${summary.missingCellCount} blank cells remain unknown`
              : "Source-backed subtotal"}
          </footer>
        </article>
        <article className="cfd-kpi">
          <div>
            <span>Total revenue</span>
            <ArrowUpRight size={18} />
          </div>
          <strong className="cfd-pending-value">Awaiting data</strong>
          <p>Insurance + schools + cash programs</p>
          <footer>Reconcile to the same reporting period</footer>
        </article>
        <article className="cfd-kpi">
          <div>
            <span>Reported loaded payroll</span>
            <Layers3 size={18} />
          </div>
          <strong className={loadedPayroll?undefined:"cfd-pending-value"}>{loadedPayroll?formatMetric(loadedPayroll):"Awaiting data"}</strong>
          <p>Wages, taxes, benefits, PTO and bonuses</p>
          <footer>{loadedPayroll?"Source payroll month; accounting match pending":"Company payroll and location allocation needed"}</footer>
        </article>
        <article className="cfd-kpi">
          <div>
            <span>Operating profit</span>
            <CircleHelp size={18} />
          </div>
          <strong className="cfd-pending-value">Not yet available</strong>
          <p>Revenue less all reconciled costs</p>
          <footer>Margin and break-even remain unavailable</footer>
        </article>
      </section>

      <div className="cfd-context-note"><CircleHelp size={16} /><p>{snapshot?.costBasis === "fixed_monthly_baseline" ? "The owner confirmed these supplied costs as fixed each month until updated. This is a recurring cost reference, not a reconciled monthly general ledger. " : `These are supplied monthly overhead amounts. ${snapshot?.effectiveMonth ? "" : "The accounting month still needs confirmation. "}`}The known subtotal is not a complete expense total or a profit calculation.</p></div>

      <CheshireValidatedMetrics {...validatedMetrics} />

      <div className="cfd-content-grid">
        <section className="cfd-panel cfd-economics">
          <header className="cfd-panel-heading">
            <div>
              <p className="cfd-eyebrow">THE BUSINESS AT A GLANCE</p>
              <h2>
                {tab === "people"
                  ? "People & allocation"
                  : tab === "costs"
                    ? "What makes up the cost"
                    : "Location economics"}
              </h2>
            </div>
            <span className="cfd-count">
              {selectedLocations.length}{" "}
              {selectedLocations.length === 1 ? "location" : "locations"}
            </span>
          </header>
          <div className="cfd-tabs" role="tablist" aria-label="Financial views">
            {(
              [
                ["locations", "By location"],
                ["costs", "Cost breakdown"],
                ["people", "People & allocation"],
              ] as const
            ).map(([id, title]) => (
              <button
                id={`cfd-tab-${id}`}
                role="tab"
                aria-selected={tab === id}
                aria-controls={`cfd-panel-${id}`}
                key={id}
                onClick={() => {
                  setTab(id);
                  setDetail(null);
                }}
              >
                {title}
              </button>
            ))}
          </div>

          {tab === "locations" ? (
            <div
              id="cfd-panel-locations"
              role="tabpanel"
              aria-labelledby="cfd-tab-locations"
            >
              <div className="cfd-table-wrap">
                <table className="cfd-location-table">
                  <thead>
                    <tr>
                      <th>Location</th>
                      <th>Known overhead / month</th>
                      <th>Source coverage</th>
                      <th>Profit</th>
                      <th>
                        <span className="cfd-sr">Details</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedLocations.map((name) => {
                      const row = total?.byLocation[name];
                      return (
                        <tr
                          key={name}
                          className={detail === name ? "selected" : ""}
                        >
                          <th scope="row">
                            <span className="cfd-location-icon">
                              <Building2 size={15} />
                            </span>
                            {name}
                          </th>
                          <td>
                            <strong>
                              {row && row.missingCategories.length < 20
                                ? money(row.knownCents)
                                : "—"}
                            </strong>
                            <span className="cfd-mini-track" aria-hidden="true">
                              <i
                                style={{
                                  width: `${row ? (row.knownCents / maxLocation) * 100 : 0}%`,
                                }}
                              />
                            </span>
                          </td>
                          <td>
                            {row ? (
                              <span
                                className={`cfd-coverage ${row.missingCategories.length ? "partial" : ""}`}
                              >
                                {20 - row.missingCategories.length}/20 entered
                              </span>
                            ) : (
                              <span className="cfd-muted">Not connected</span>
                            )}
                          </td>
                          <td>
                            <span className="cfd-muted">Pending</span>
                          </td>
                          <td>
                            <button
                              aria-label={`View ${name} overhead details`}
                              aria-expanded={detail === name}
                              disabled={!row}
                              onClick={() =>
                                setDetail(detail === name ? null : name)
                              }
                            >
                              <ChevronRight size={17} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr>
                      <th>
                        {location === "all"
                          ? "Company known subtotal"
                          : `${location} known subtotal`}
                      </th>
                      <td>
                        {summary && summary.knownCells > 0
                          ? money(summary.knownTotalCents)
                          : "—"}
                      </td>
                      <td>
                        {summary
                          ? `${summary.missingCellCount} unknown cells`
                          : "Source required"}
                      </td>
                      <td>Unavailable</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
              {detail && snapshot ? (
                <div className="cfd-detail" aria-live="polite">
                  <header>
                    <div>
                      <h3>{detail} · source detail</h3>
                      <p>
                        Monthly reference costs, with original workbook cell
                        references
                      </p>
                    </div>
                    <button onClick={() => setDetail(null)}>Close</button>
                  </header>
                  <div className="cfd-detail-grid">
                    {snapshot.rows
                      .filter((row) => row.location === detail)
                      .map((row) => (
                        <div key={row.category}>
                          <span>
                            {row.category}
                            <small>Cell {row.sourceCell}</small>
                          </span>
                          <strong
                            className={row.amount === null ? "cfd-unknown" : ""}
                          >
                            {row.amount === null
                              ? "Unknown"
                              : money(amountToCents(row.amount))}
                          </strong>
                        </div>
                      ))}
                  </div>
                </div>
              ) : null}
              <div className="cfd-table-note">
                <span className="cfd-dot" /> Blank costs remain unknown. An
                entered $0.00 is a confirmed source zero.
              </div>
            </div>
          ) : null}

          {tab === "costs" ? (
            <div
              id="cfd-panel-costs"
              role="tabpanel"
              aria-labelledby="cfd-tab-costs"
              className="cfd-cost-list"
            >
              {categories.map((item) => (
                <div className="cfd-cost-row" key={item.category}>
                  <div>
                    <strong>{item.category}</strong>
                    <span>
                      {summary
                        ? item.missing
                          ? `${item.missing} location ${item.missing === 1 ? "cell is" : "cells are"} unknown`
                          : "All selected source cells entered"
                        : "Protected source required"}
                    </span>
                  </div>
                  <span className="cfd-cost-track" aria-hidden="true">
                    <i
                      style={{ width: `${(item.known / maxCategory) * 100}%` }}
                    />
                  </span>
                  <strong>
                    {summary
                      ? item.count > item.missing
                        ? money(item.known)
                        : "Unknown"
                      : "—"}
                  </strong>
                </div>
              ))}
            </div>
          ) : null}

          {tab === "people" ? (
            <div
              id="cfd-panel-people"
              role="tabpanel"
              aria-labelledby="cfd-tab-people"
              className="cfd-people"
            >
              <p className="cfd-people-intro">
                Account for the whole team. Allocate paid time across locations,
                clinic work and school services using actual hours or an agreed,
                effective-dated rule.
              </p>
              {LABOR_ROLES.map((role) => (
                <div key={role.name}>
                  <span>
                    <strong>{role.name}</strong>
                    <small>{role.detail}</small>
                  </span>
                  <span className="cfd-coverage partial">Current-period source needed</span>
                </div>
              ))}
              <p className="cfd-people-foot">
                No assumed 50/50 split. Allocations must total 100%, with no
                salary or shared cost counted twice. Therapist-level
                profitability awaits approved cost and overhead allocation.
              </p>
            </div>
          ) : null}
        </section>

        <CheshireMonthlyIntakeReview snapshot={snapshot} />
      </div>

      <section className="cfd-streams" aria-labelledby="cfd-stream-title">
        <header>
          <div>
            <p className="cfd-eyebrow">THREE REVENUE STREAMS</p>
            <h2 id="cfd-stream-title">
              Different models. A connected business.
            </h2>
          </div>
          <span>Same-period reconciliation required</span>
        </header>
        <div className="cfd-stream-grid">
          <article>
            <span className="cfd-stream-no">01 / CLINICS</span>
            <h3>Insurance</h3>
            <p>Visits, units and payments by location, therapist and payer.</p>
            <footer>
              <span>{validatedMetrics.data?.sources.some(source=>source.source_type==='insurance_revenue')?'Validated source figures above':'Current-period source needed'}</span>
              <ArrowDown size={16} />
            </footer>
            <small>Keep service dates and payment dates distinct.</small>
          </article>
          <article>
            <span className="cfd-stream-no">02 / DISTRICTS</span>
            <h3>School contracts</h3>
            <p>
              District invoices, contract rates and clinic/school staff time.
            </p>
            <footer>
              <span>{validatedMetrics.data?.sources.some(source=>source.source_type==='school_billing')?'Validated source figures above':'Current-period source needed'}</span>
              <ArrowDown size={16} />
            </footer>
            <small>
              Clinic occupancy exclusions do not eliminate school labor or
              administration.
            </small>
          </article>
          <article>
            <span className="cfd-stream-no">03 / SPECIALTY</span>
            <h3>Cash programs</h3>
            <p>Program income, direct staffing and relevant operating costs.</p>
            <footer>
              <span>{validatedMetrics.data?.sources.some(source=>source.source_type==='cash_programs')?'Validated source figures above':'Current-period source needed'}</span>
              <ArrowDown size={16} />
            </footer>
            <small>
              Separate specialty revenue from patient insurance copays.
            </small>
          </article>
        </div>
      </section>

      <footer className="cfd-provenance">
        <span>
          <LockKeyhole size={13} />{" "}
          {snapshot ? snapshot.sourceName : "Protected source pending"}
        </span>
        <span>
          {snapshot
            ? `Imported ${new Date(snapshot.importedAt).toLocaleString("en-US", { timeZone: "UTC", dateStyle: "medium", timeStyle: "short" })} UTC`
            : "No financial data is embedded in this page"}{" "}
          · Read-only
        </span>
      </footer>
    </main>
  );
}
