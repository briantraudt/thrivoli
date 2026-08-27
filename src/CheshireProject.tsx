import { Link } from "react-router-dom";
import "./cheshire-project.css";

const segments = [
  { number:"01", name:"Clinics", tone:"blue", reporting:["Clinic location"], services:["PT","OT","Feeding","Speech"], revenue:["Medicaid","Commercial insurance","Patient responsibility","Self-pay"], labor:["Therapist wages","Payroll taxes","Benefits","Contract labor","PTO / nonproductive time"], operating:["Rent","Utilities","Cleaning","Dumpster","Supplies","Local repairs"] },
  { number:"02", name:"Schools", tone:"orange", reporting:["School district / contract","Individual school if needed"], services:["PT hours","OT hours","Speech hours"], revenue:["Hourly contract","Fixed contract","Other contract rate","Invoiced / collected / outstanding"], labor:["Therapist school hours","Payroll burden","Contract labor","Travel time","Documentation / prep"], operating:["Mileage / travel","School supplies","Contract-specific costs","District fees"] },
  { number:"03", name:"Private Programs", tone:"green", reporting:["Program location","Program / session"], services:["Swim lessons","DMI / Intensives","Other private programs"], revenue:["Cash / card sales","Packages","Discounts","Refunds"], labor:["Instructor / therapist wages","Payroll burden","Contract instructors","Setup / prep time"], operating:["Program supplies","Pool / facility cost","Equipment","Program marketing"] },
];

function Mark() { return <span className="thrivoli-mark" aria-hidden="true">t</span>; }
function Tags({items}:{items:string[]}) { return <div className="project-tags">{items.map((item)=><span key={item}>{item}</span>)}</div>; }

export function PublicHome() {
  return <main className="public-home"><Link to="/cheshire" className="public-brand" aria-label="Thrivoli"><Mark/><span>thrivoli</span></Link></main>;
}

export function CheshireProject() {
  return <main className="project-page">
    <header className="project-masthead">
      <Link to="/" className="project-brand"><Mark/><span>thrivoli</span></Link>
      <div><p className="project-kicker">Cheshire Fitness Zone · Project update</p><h1>Profitability Map</h1></div>
      <p className="project-intro">The operating model connecting revenue, labor, expenses, and overhead to profitability by location, contract, therapist, and service line.</p>
    </header>
    <section className="profitability-map" aria-label="Cheshire profitability structure">
      <div className="project-root"><span>Cheshire</span> Profitability</div><div className="project-connector" aria-hidden="true"/>
      <div className="project-segments">{segments.map((segment)=><article className={`project-segment ${segment.tone}`} key={segment.name}>
        <header><span>{segment.number}</span><h2>{segment.name}</h2></header>
        <section><h3>Reporting unit</h3><Tags items={segment.reporting}/></section>
        <section><h3>Service revenue</h3><Tags items={segment.services}/></section>
        <section><h3>Revenue type</h3><Tags items={segment.revenue}/></section>
        <section className="project-cost"><h3>Direct labor</h3><Tags items={segment.labor}/></section>
        <section className="project-cost"><h3>Direct operating expense</h3><Tags items={segment.operating}/></section>
      </article>)}</div>
      <section className="project-band overhead-band"><div className="project-band-heading"><span>04</span><h2>Shared overhead</h2><p>Allocated across segments and reporting units</p></div><div className="project-grid">
        <div><strong>Administrative labor</strong><span>FTE or labor hours</span></div><div><strong>Billing &amp; software</strong><span>Claims, visits or users</span></div><div><strong>Insurance &amp; professional fees</strong><span>Approved causal driver</span></div><div><strong>Corporate G&amp;A</strong><span>Documented blended allocation</span></div>
      </div></section>
      <section className="project-calculation"><span>05 · Profitability calculation</span><div><strong>Revenue</strong><i>−</i><strong>Direct labor</strong><i>=</i><strong>Contribution margin</strong><i>−</i><strong>Direct operating expense</strong><i>−</i><strong>Shared overhead</strong><i>=</i><strong>Operating profit</strong></div></section>
      <section className="project-band output-band"><div className="project-band-heading"><span>06</span><h2>Dashboard views</h2><p>The same economics, viewed from four angles</p></div><div className="project-grid">
        <div><strong>By location</strong><span>Each clinic and program location</span></div><div><strong>By school contract</strong><span>District, contract, optional school</span></div><div><strong>By therapist</strong><span>Clinic, school, and private work</span></div><div><strong>By service line</strong><span>PT, OT, Feeding, Speech, Swim, DMI</span></div>
      </div></section>
    </section>
    <footer className="project-footer">Earned revenue · Cash collected · Contribution margin · Operating profit · Margin % · Utilization · Break-even visits or hours</footer>
  </main>;
}
