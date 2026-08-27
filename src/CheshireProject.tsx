import { ArrowDown, ArrowRight, Building2, GraduationCap, Layers3, Waves } from "lucide-react";
import { Link } from "react-router-dom";
import "./cheshire-project.css";

const segments = [
  { number:"01", name:"Clinics", subtitle:"Insurance-based clinical care", tone:"blue", icon:Building2, reporting:["Clinic location"], services:["PT","OT","Feeding","Speech"], revenue:["Medicaid","Commercial insurance","Patient responsibility","Self-pay"], labor:["Therapist wages","Payroll taxes","Benefits","Contract labor","PTO / nonproductive time"], operating:["Rent","Utilities","Cleaning","Dumpster","Supplies","Local repairs"] },
  { number:"02", name:"Schools", subtitle:"District and school contracts", tone:"orange", icon:GraduationCap, reporting:["School district / contract","Individual school if needed"], services:["PT hours","OT hours","Speech hours"], revenue:["Hourly contract","Fixed contract","Other contract rate","Invoiced / collected / outstanding"], labor:["Therapist school hours","Payroll burden","Contract labor","Travel time","Documentation / prep"], operating:["Mileage / travel","School supplies","Contract-specific costs","District fees"] },
  { number:"03", name:"Private Programs", subtitle:"Cash-pay programs and intensives", tone:"green", icon:Waves, reporting:["Program location","Program / session"], services:["Swim lessons","DMI / Intensives","Other private programs"], revenue:["Cash / card sales","Packages","Discounts","Refunds"], labor:["Instructor / therapist wages","Payroll burden","Contract instructors","Setup / prep time"], operating:["Program supplies","Pool / facility cost","Equipment","Program marketing"] },
];

function Mark() { return <span className="thrivoli-mark" aria-hidden="true">t</span>; }
function Tags({items,kind="standard"}:{items:string[];kind?:"standard"|"revenue"|"cost"}) { return <div className={`project-tags ${kind}`}>{items.map((item)=><span key={item}>{item}</span>)}</div>; }

export function PublicHome() {
  return <main className="public-home"><Link to="/cheshire" className="public-brand" aria-label="Thrivoli"><Mark/><span>thrivoli</span></Link></main>;
}

export function CheshireProject() {
  return <main className="project-page">
    <header className="project-header">
      <Link to="/" className="project-brand"><Mark/><span>thrivoli</span></Link>
      <span className="project-status"><i/>Project design · August 2026</span>
    </header>

    <section className="project-hero">
      <div><p className="project-kicker">Cheshire Fitness Zone</p><h1>A clearer path to<br/><em>profitability.</em></h1></div>
      <div className="hero-copy"><p>One operating model that connects every dollar of revenue and expense to the location, contract, therapist, and service line responsible for it.</p><a href="#segments">Explore the model <ArrowDown size={15}/></a></div>
    </section>

    <nav className="project-nav" aria-label="Page sections">
      <a href="#segments"><b>01</b><span>Business segments</span></a>
      <ArrowRight aria-hidden="true"/>
      <a href="#overhead"><b>02</b><span>Shared overhead</span></a>
      <ArrowRight aria-hidden="true"/>
      <a href="#calculation"><b>03</b><span>Profit calculation</span></a>
      <ArrowRight aria-hidden="true"/>
      <a href="#views"><b>04</b><span>Dashboard views</span></a>
    </nav>

    <section className="model-section" id="segments">
      <div className="section-heading"><div><span>Step 01</span><h2>Start with how Cheshire earns revenue</h2></div><p>Each business segment has its own reporting unit, revenue model, labor profile, and direct operating costs.</p></div>
      <div className="project-segments">{segments.map((segment)=><article className={`project-segment ${segment.tone}`} key={segment.name}>
        <header><div className="segment-icon"><segment.icon size={22}/></div><div><span>{segment.number}</span><h3>{segment.name}</h3><p>{segment.subtitle}</p></div></header>
        <div className="segment-block identity"><h4>Measure profitability by</h4><Tags items={segment.reporting}/></div>
        <div className="segment-block revenue-block"><div className="block-title"><span>Revenue</span><small>What we sell</small></div><h4>Service line</h4><Tags items={segment.services} kind="revenue"/><h4>Revenue source</h4><Tags items={segment.revenue} kind="revenue"/></div>
        <div className="segment-block cost-block"><div className="block-title"><span>Costs</span><small>What it takes to deliver</small></div><h4>Direct labor</h4><Tags items={segment.labor} kind="cost"/><h4>Direct operating expense</h4><Tags items={segment.operating} kind="cost"/></div>
      </article>)}</div>
    </section>

    <section className="overhead-section" id="overhead">
      <div className="section-heading inverse"><div><span>Step 02</span><h2>Add only the costs Cheshire shares</h2></div><p>Direct costs stay where they occurred. Shared costs use a documented driver instead of one blanket percentage.</p></div>
      <div className="overhead-grid">
        <div><b>01</b><Layers3/><strong>Administrative labor</strong><span>Allocate by FTE or labor hours</span></div>
        <div><b>02</b><Layers3/><strong>Billing &amp; software</strong><span>Allocate by claims, visits, or users</span></div>
        <div><b>03</b><Layers3/><strong>Insurance &amp; professional fees</strong><span>Use the approved causal driver</span></div>
        <div><b>04</b><Layers3/><strong>Corporate G&amp;A</strong><span>Use a documented blended allocation</span></div>
      </div>
    </section>

    <section className="calculation-section" id="calculation">
      <div className="section-heading"><div><span>Step 03</span><h2>Turn the model into one trusted profit calculation</h2></div><p>The exact same calculation can be used for a clinic, school contract, therapist, or service line.</p></div>
      <div className="equation-flow">
        <div className="equation-node start"><small>Begin with</small><strong>Revenue</strong></div><i>−</i>
        <div className="equation-node"><small>Subtract</small><strong>Direct labor</strong></div><i>=</i>
        <div className="equation-node highlight"><small>First answer</small><strong>Contribution margin</strong></div><i>−</i>
        <div className="equation-node"><small>Subtract</small><strong>Direct expenses</strong></div><i>−</i>
        <div className="equation-node"><small>Allocate</small><strong>Shared overhead</strong></div><i>=</i>
        <div className="equation-node finish"><small>Final answer</small><strong>Operating profit</strong></div>
      </div>
    </section>

    <section className="views-section" id="views">
      <div className="section-heading"><div><span>Step 04</span><h2>See the business from every useful angle</h2></div><p>Leadership can change the view without changing the underlying accounting logic.</p></div>
      <div className="view-grid">
        <div><b>01</b><strong>By location</strong><span>Each clinic and program location</span></div>
        <div><b>02</b><strong>By school contract</strong><span>District, contract, and optional school</span></div>
        <div><b>03</b><strong>By therapist</strong><span>Clinic, school, and private work together</span></div>
        <div><b>04</b><strong>By service line</strong><span>PT, OT, Feeding, Speech, Swim, and DMI</span></div>
      </div>
      <div className="measure-strip"><span>Weekly management measures</span><div>Earned revenue</div><div>Cash collected</div><div>Contribution margin</div><div>Operating profit</div><div>Utilization</div><div>Break-even volume</div></div>
    </section>

    <footer className="project-footer"><Link to="/"><Mark/><span>thrivoli</span></Link><p>Cheshire profitability dashboard · Working project design</p></footer>
  </main>;
}
