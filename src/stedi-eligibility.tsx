import { useState } from "react";
import {
  CheckCircle2,
  ChevronRight,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";

type EligibilityResult = {
  id: string | null;
  traceId: string | null;
  mode: string;
  checkedAt: string;
  payer: string;
  subscriber: { name: string; memberId: string };
  coverage: { status: string; plan: string | null; serviceTypes: string[] }[];
  benefits: {
    name: string;
    status: string | null;
    amount: string | null;
    network: string | null;
    messages: string[];
  }[];
  errors: string[];
};

function humanizeStatus(status: string) {
  const normalized = status.toLowerCase();
  if (normalized === "1" || normalized.includes("active")) return "Active";
  if (normalized === "6" || normalized.includes("inactive")) return "Inactive";
  return status;
}

const patients = [
  {
    name: "Jordan Lee",
    guardian: "Elena Lee",
    payer: "Aetna",
    memberId: "•••• 4821",
    status: "Active",
    detail: "Verified today",
    tone: "positive",
    sandbox: false,
  },
  {
    name: "Mason Hernandez",
    guardian: "Sofia Hernandez",
    payer: "Anthem",
    memberId: "•••• 1834",
    status: "Recheck",
    detail: "Last checked 28 days ago",
    tone: "attention",
    sandbox: false,
  },
  {
    name: "Avery King",
    guardian: "Dana King",
    payer: "ConnectiCare",
    memberId: "•••• 7092",
    status: "Auth risk",
    detail: "4 visits remaining",
    tone: "warning",
    sandbox: false,
  },
  {
    name: "Bernie Prohas",
    guardian: "Stedi synthetic subscriber",
    payer: "STEDI",
    memberId: "23051322",
    status: "Ready",
    detail: "Approved sandbox patient",
    tone: "info",
    sandbox: true,
  },
] as const;

export function StediEligibility() {
  const [result, setResult] = useState<EligibilityResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const runCheck = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/stedi/eligibility", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "stedi-test" }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Eligibility check failed.");
      setResult(payload);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Eligibility check failed.",
      );
    } finally {
      setLoading(false);
    }
  };

  const activeCoverage = result?.coverage.find((item) =>
    ["1", "active"].includes(item.status.toLowerCase()),
  );

  return (
    <section className="card eligibility-console" aria-labelledby="stedi-title">
      <div className="eligibility-heading">
        <div>
          <span className="eyebrow">Patient coverage</span>
          <h2 id="stedi-title">Insurance eligibility</h2>
          <p>
            Verify coverage before the visit, surface authorization risk, and
            keep front-desk follow-up connected to each patient.
          </p>
        </div>
        <span className="sandbox-chip">
          <ShieldCheck size={14} /> Stedi connected
        </span>
      </div>

      <div className="eligibility-overview">
        <div><span>Verified</span><strong>186</strong><small>92% of active patients</small></div>
        <div><span>Needs recheck</span><strong>11</strong><small>Before next appointment</small></div>
        <div><span>Authorization risk</span><strong>8</strong><small>34 visits potentially blocked</small></div>
        <div><span>Coverage issues</span><strong>3</strong><small>Assigned to front desk</small></div>
      </div>

      <div className="patient-eligibility-list" role="table" aria-label="Patient eligibility">
        <div className="patient-eligibility-header" role="row">
          <span>Patient</span><span>Insurance</span><span>Eligibility</span><span>Action</span>
        </div>
        {patients.map((patient) => (
          <div className={`patient-eligibility-row ${patient.sandbox ? "sandbox-row" : ""}`} role="row" key={patient.name}>
            <div role="cell"><strong>{patient.name}</strong><small>{patient.guardian}</small></div>
            <div role="cell"><strong>{patient.payer}</strong><small>Member {patient.memberId}</small></div>
            <div role="cell">
              <span className={`status status-${patient.tone}`}><i />{patient.status}</span>
              <small>{patient.detail}</small>
            </div>
            <div role="cell">
              {patient.sandbox ? (
                <button className="primary eligibility-row-action" onClick={runCheck} disabled={loading}>
                  <RefreshCw size={14} className={loading ? "spin" : ""} />
                  {loading ? "Checking…" : result ? "Run again" : "Run Stedi test"}
                </button>
              ) : (
                <button className="row-link" type="button">View coverage <ChevronRight size={14} /></button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="eligibility-patient">
        <div>
          <span>Sandbox subscriber</span>
          <strong>Bernie Prohas</strong>
          <small>Member 23051322</small>
        </div>
        <div>
          <span>Test provider</span>
          <strong>STEDI</strong>
          <small>NPI 1447848577</small>
        </div>
        <div>
          <span>Service</span>
          <strong>Health benefit plan</strong>
          <small>Service type 30</small>
        </div>
        <span className="sandbox-chip"><ShieldCheck size={14} /> No real PHI</span>
      </div>

      {error && (
        <div className="eligibility-alert eligibility-alert-error" role="alert">
          <TriangleAlert size={17} />
          <div>
            <strong>Eligibility check could not be completed</strong>
            <span>{error}</span>
          </div>
        </div>
      )}

      {result && (
        <div className="eligibility-result" aria-live="polite">
          <div className="eligibility-alert eligibility-alert-success">
            <CheckCircle2 size={18} />
            <div>
              <strong>
                {activeCoverage
                  ? `${humanizeStatus(activeCoverage.status)} coverage returned`
                  : "Stedi response received"}
              </strong>
              <span>
                {result.payer} · Checked{" "}
                {new Date(result.checkedAt).toLocaleString()}
              </span>
            </div>
            <span className="status status-positive">
              <i />
              {result.mode === "test" ? "Sandbox" : result.mode}
            </span>
          </div>

          <div className="eligibility-summary">
            <div>
              <span>Subscriber</span>
              <strong>{result.subscriber.name}</strong>
              <small>{result.subscriber.memberId}</small>
            </div>
            <div>
              <span>Coverage</span>
              <strong>
                {result.coverage.length
                  ? result.coverage.map((item) => humanizeStatus(item.status)).join(", ")
                  : "Response received"}
              </strong>
              <small>{activeCoverage?.plan || "See payer benefit details"}</small>
            </div>
            <div>
              <span>Stedi check ID</span>
              <strong>{result.id || "Available in Stedi"}</strong>
              <small>Trace {result.traceId || "not returned"}</small>
            </div>
          </div>

          {!!result.benefits.length && (
            <div className="benefit-list">
              <div className="benefit-list-heading">
                <span className="eyebrow">Benefit details</span>
                <strong>{result.benefits.length} items returned</strong>
              </div>
              {result.benefits.slice(0, 8).map((benefit, index) => (
                <div className="benefit-row" key={`${benefit.name}-${index}`}>
                  <div>
                    <strong>{benefit.name}</strong>
                    <small>
                      {[benefit.network, ...benefit.messages].filter(Boolean).join(" · ") ||
                        "No additional payer message"}
                    </small>
                  </div>
                  <span>{benefit.amount || benefit.status || "Included"}</span>
                </div>
              ))}
            </div>
          )}

          {!!result.errors.length && (
            <div className="eligibility-response-errors">
              {result.errors.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
          )}
        </div>
      )}

      <p className="eligibility-footnote">
        Sandbox requests use Stedi’s approved fictional test data. Production
        eligibility will require a production account, payer validation, patient
        consent workflows, access controls, audit logging, and a signed BAA.
      </p>
    </section>
  );
}
