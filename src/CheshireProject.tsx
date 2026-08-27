import { Building2, GraduationCap, Waves } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import "./cheshire-project.css";
import "./cheshire-workflow.css";
import "./cheshire-layout-fix.css";

const segments = [
  { number:"1", name:"Clinics", icon:Building2, tone:"blue", unit:["Clinic location","Individual therapist"], services:["PT","OT – General","OT – Feeding","Speech"], revenue:["Commercial – fee for service","Capitated plans","Medicaid","Patient responsibility","Self-pay"], labor:["Therapist wages","Payroll taxes","Benefits","Contract labor","PTO / nonproductive time","Documentation / prep"], expenses:["Rent","Utilities","Cleaning","Dumpster","Clinical supplies","Equipment","Repairs & maintenance"] },
  { number:"2", name:"Schools", icon:GraduationCap, tone:"orange", unit:["School district / contract","Individual school","Individual therapist"], services:["PT hours","OT hours","Speech hours"], revenue:["Hourly contract","Fixed contract","Other contract rate","Invoiced","Collected","Outstanding A/R"], labor:["Therapist school hours","Payroll burden","Contract labor","Travel time","Documentation / prep"], expenses:["Mileage / travel","School supplies","Contract-specific costs","District fees"] },
  { number:"3", name:"Private Programs", icon:Waves, tone:"green", unit:["Program location","Program / session","Instructor / therapist"], services:["Swim lessons","DMI / Intensives","Other programs"], revenue:["Single-session sales","Packages","Cash / card","Discounts / refunds"], labor:["Instructor / therapist wages","Payroll burden","Contract instructors","Setup / prep time"], expenses:["Program supplies","Pool / facility cost","Equipment","Program marketing","Merchant processing fees"] },
];

function Mark(){return <span className="thrivoli-mark" aria-hidden="true">t</span>}
function Tags({items}:{items:string[]}){return <div className="tree-tags">{items.map(item=><span key={item}>{item}</span>)}</div>}
export function PublicHome(){return <main className="public-home"><Link to="/cheshire" className="public-brand" aria-label="Thrivoli"><Mark/><span>thrivoli</span></Link></main>}

export function CheshireProject(){
  const [active,setActive]=useState<string|null>(null);
  return <main className="tree-page"><section className="tree-canvas" aria-label="Cheshire profitability model">
    <div className="tree-top">
      <div className="tree-root"><strong>Profitability Map</strong></div>
      <div className="tree-legend" aria-label="Color legend">
        <span className="revenue-key">Revenue</span><span className="expense-key">Expenses</span><span className="overhead-key">Overhead</span>
      </div>
    </div>
    <div className="tree-columns">{segments.map(segment=><article className={`tree-card ${segment.tone} ${active&&active!==segment.name?"is-muted":""} ${active===segment.name?"is-active":""}`} key={segment.name}>
      <button className="tree-card-header" type="button" aria-pressed={active===segment.name} onClick={()=>setActive(active===segment.name?null:segment.name)}><span className="tree-number">{segment.number}</span><segment.icon size={21} aria-hidden="true"/><h2>{segment.name}</h2><span className="focus-hint">{active===segment.name?"Show all":"Focus"}</span></button>
      <section className="tree-row unit"><h3><b>1</b> Assign to</h3><Tags items={segment.unit}/></section>
      <section className="tree-row revenue"><h3><b>2A</b> Revenue · Service line</h3><Tags items={segment.services}/></section>
      <section className="tree-row revenue-source"><h3><b>2B</b> Revenue · Model / source</h3><Tags items={segment.revenue}/></section>
      <section className="tree-row cost"><h3><b>3A</b> Expense · Direct labor</h3><Tags items={segment.labor}/></section>
      <section className="tree-row cost"><h3><b>3B</b> Expense · Direct operating</h3><Tags items={segment.expenses}/></section>
    </article>)}</div>
    <section className="tree-bottom"><div className="shared-costs"><h2><b>4</b> Allocate shared overhead <small>using a documented driver</small></h2><Tags items={["Administrative labor","Billing & software","Insurance & professional fees","Corporate G&A"]}/></div><div className="profit-output"><span><b>5</b> Profitability dashboard</span><strong>Location · Contract · Therapist · Service line</strong><small>Revenue · Contribution margin · Operating profit · Utilization · Break-even</small></div></section>
  </section></main>
}
