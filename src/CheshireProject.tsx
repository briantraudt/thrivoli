import { Building2, GraduationCap, Waves } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import "./cheshire-project.css";
import "./cheshire-workflow.css";
import "./cheshire-layout-fix.css";

type Segment = {
  name:string; icon:typeof Building2; tone:string;
  services:string[]; payers:string[]; revenueStatus:string[]; revenueTiming:string[];
  labor:string[]; operations:string[]; siteOverhead:string[];
};

const volume=["Visits / sessions","Billable units","Scheduled vs. completed","Cancellations","No-shows","Evals vs. follow-ups","Schedule fill %"];
const sharedLabor=["Wages / salary","Payroll taxes","Benefits","Skill mix · PT / PTA / aide / student","Overtime","Contract / traveler premium","CEU & licensure","Credentialing","Recruiting / sign-on"];
const siteOverhead=["Front-desk labor","Local marketing","Telecom / IT","Leasehold amortization"];

const segments:Segment[]=[
  {
    name:"Clinics",icon:Building2,tone:"blue",
    services:["PT","OT – General","OT – Feeding","Speech"],
    payers:["Commercial insurers","Medicaid","Copay / coinsurance","Deductible","Self-pay"],
    revenueStatus:["Earned / accrued","Charged / invoiced","Contractual adjustment","Expected revenue","Collected","Outstanding A/R","Bad debt","Credit balances / patient refunds"],
    revenueTiming:["Service-date accrual","Claims lag"],
    labor:[...sharedLabor,"Contract labor","Treatment time","Documentation / prep","PTO / nonproductive"],
    operations:["Rent","Utilities","Cleaning / waste","Clinical supplies","Practice Pro / ClaimMD","Merchant processing fees","Malpractice / liability","IT / telecom","Equipment / depreciation","Repairs & maintenance"],
    siteOverhead,
  },
  {
    name:"Schools",icon:GraduationCap,tone:"orange",
    services:["PT hours","OT hours","Speech hours"],
    payers:["School district / LEA","Individual school","Other education organization"],
    revenueStatus:["Earned / accrued","Charged / invoiced","Contractual adjustment","Expected revenue","Collected","Outstanding A/R"],
    revenueTiming:["Contract accrual","Deferred / unearned","Recognized as hours delivered"],
    labor:[...sharedLabor,"Contract labor","Service hours","Travel time","Documentation / prep"],
    operations:["Mileage / travel","School supplies","Contract-specific costs","District fees"],
    siteOverhead,
  },
  {
    name:"Private Programs",icon:Waves,tone:"green",
    services:["Swim lessons","DMI / Intensives","Other programs"],
    payers:["Patient / family","Program participant","Third-party sponsor · if applicable"],
    revenueStatus:["Charged / sold","Expected revenue","Collected","Outstanding A/R","Discounts","Refunds"],
    revenueTiming:["Prepaid packages","Deferred / unearned","Recognized as sessions delivered"],
    labor:[...sharedLabor,"Contract instructors","Program delivery","Setup / prep"],
    operations:["Program supplies","Pool / facility cost","Equipment / depreciation","Program marketing","Merchant processing fees"],
    siteOverhead,
  },
];

const sourceRows=[
  ["Volume & capacity","Practice Pro / school schedules","Operations","Weekly","N/A"],
  ["Services & payer","Practice Pro / contracts","Billing","Weekly","Map to chart of accounts"],
  ["Revenue status","ClaimMD + QuickBooks","Billing / Finance","Weekly","Map to chart of accounts"],
  ["Direct labor","ADP + schedules","HR / Operations","Weekly","Map to chart of accounts"],
  ["Direct operating","QuickBooks","Finance","Weekly","Map to chart of accounts"],
  ["Site overhead","QuickBooks + ADP","Finance","Monthly","Map to chart of accounts"],
  ["Corporate overhead","QuickBooks + ADP","Finance","Monthly","Map to chart of accounts"],
];

function Mark(){return <span className="thrivoli-mark" aria-hidden="true">t</span>}
function Tags({items}:{items:string[]}){return <div className="tree-tags">{items.map(item=><span key={item}>{item}</span>)}</div>}
function MapRow({label,items,tone}:{label:string;items:string[];tone:string}){return <section className={`tree-row ${tone}`}><span className="section-type">{label}</span><Tags items={items}/></section>}
export function PublicHome(){return <main className="public-home"><Link to="/cheshire" className="public-brand" aria-label="Thrivoli"><Mark/><span>thrivoli</span></Link></main>}

export function CheshireProject(){
  const [active,setActive]=useState<string|null>(null);
  return <main className="tree-page"><section className="tree-canvas" aria-label="Cheshire profitability model">
    <div className="tree-top">
      <div className="tree-root"><strong>Profitability Map</strong></div>
      <div className="tree-legend" aria-label="Color legend"><span className="revenue-key">Revenue</span><span className="expense-key">Expenses</span><span className="overhead-key">Overhead</span></div>
      <div className="accounting-basis"><strong>Accounting basis</strong><span>Accrual</span><i/><strong>Companion view</strong><span>Cash &amp; A/R</span></div>
    </div>

    <div className="tree-columns">{segments.map(segment=><article className={`tree-card ${segment.tone} ${active&&active!==segment.name?"is-muted":""} ${active===segment.name?"is-active":""}`} key={segment.name}>
      <button className="tree-card-header" type="button" aria-pressed={active===segment.name} onClick={()=>setActive(active===segment.name?null:segment.name)}><segment.icon size={21} aria-hidden="true"/><div className="segment-title"><h2>{segment.name}</h2></div></button>
      <MapRow label="Volume & capacity" items={volume} tone="volume"/>
      <MapRow label="Service" items={segment.services} tone="service"/>
      <MapRow label="Payer" items={segment.payers} tone="revenue-source"/>
      <MapRow label="Revenue status" items={segment.revenueStatus} tone="revenue-source"/>
      <MapRow label="Revenue timing" items={segment.revenueTiming} tone="revenue-source"/>
      <MapRow label="Expense · Labor" items={segment.labor} tone="cost"/>
      <MapRow label="Expense · Operations" items={segment.operations} tone="cost"/>
      <MapRow label="Site overhead" items={segment.siteOverhead} tone="overhead"/>
    </article>)}</div>

    <section className="tree-bottom">
      <div className="shared-costs"><h2>Step 3 · Corporate overhead</h2><Tags items={["Administrative labor → visits","Insurance & professional fees → net revenue","Corporate G&A → headcount","Owner compensation → headcount","Corporate marketing → net revenue","Interest & debt service → direct trace"]}/></div>
      <div className="profit-step"><h2>Step 4 · Profitability dashboard</h2><strong>Location · Business line · Provider · Product line</strong><p>Net revenue · Loaded labor · Contribution margin · Operating profit · Utilization · Break-even · Cash / A/R</p></div>
    </section>

    <section className="implementation-sections" aria-label="Profitability implementation framework">
      <h2>Data &amp; reporting framework</h2>
      <div className="framework-card source-map"><h3>Data source map</h3><div className="data-table" role="table">
        <div className="table-head" role="row"><b>Row</b><b>Source</b><b>Owner</b><b>Refresh</b><b>GL range</b></div>
        {sourceRows.map(row=><div role="row" key={row[0]}>{row.map(cell=><span role="cell" key={cell}>{cell}</span>)}</div>)}
      </div></div>
      <div className="framework-grid">
        <div className="framework-card"><h3>Join keys</h3><Tags items={["Location code","Provider ID","Service / CPT code","Payer ID","Period"]}/></div>
        <div className="framework-card"><h3>Metric definitions</h3><dl><dt>Net revenue</dt><dd>Earned revenue less contractual adjustments, denials, refunds, and bad debt.</dd><dt>Loaded labor</dt><dd>Wages plus payroll taxes, benefits, premiums, and allocated paid time.</dd><dt>Contribution margin</dt><dd>Net revenue less direct labor and direct operating costs.</dd><dt>Operating profit</dt><dd>Contribution margin less site and allocated corporate overhead.</dd><dt>Utilization</dt><dd>Billable service time divided by available productive time.</dd><dt>Break-even</dt><dd>Volume required for contribution margin to cover site and corporate overhead.</dd></dl></div>
        <div className="framework-card"><h3>Targets &amp; thresholds</h3><Tags items={["Margin target by stream","Contribution per visit / hour","Break-even visits by location","Budget variance","Prior-year variance"]}/></div>
        <div className="framework-card"><h3>Audience &amp; cadence</h3><div className="mini-table"><b>Executive · Monthly</b><span>Capital, staffing, and portfolio decisions</span><b>Operations · Weekly</b><span>Capacity, productivity, and corrective action</span><b>Billing / Finance · Weekly</b><span>Revenue leakage, collections, and close readiness</span></div></div>
      </div>
      <div className="kpi-grid">
        <div className="framework-card"><h3>Clinics KPIs</h3><Tags items={["Visits / day / clinician","Net collection rate","Days in A/R"]}/></div>
        <div className="framework-card"><h3>Schools KPIs</h3><Tags items={["Hours delivered vs. contracted","Margin per district","Renewal date"]}/></div>
        <div className="framework-card"><h3>Private Programs KPIs</h3><Tags items={["Enrollment fill rate","Instructor : student ratio","Revenue per pool hour"]}/></div>
      </div>
    </section>
  </section></main>
}
