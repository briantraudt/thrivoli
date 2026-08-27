import { Building2, GraduationCap, Waves } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import "./cheshire-project.css";

const segments = [
  { number:"1", name:"Clinics", icon:Building2, tone:"blue", unit:["Clinic location"], services:["PT","OT","Feeding","Speech"], revenue:["Medicaid","Commercial insurance","Patient responsibility","Self-pay"], labor:["Therapist wages","Payroll taxes","Benefits","Contract labor","PTO / nonproductive time"], expenses:["Rent","Utilities","Cleaning","Dumpster","Supplies","Local repairs"] },
  { number:"2", name:"Schools", icon:GraduationCap, tone:"orange", unit:["School district / contract","Individual school if needed"], services:["PT hours","OT hours","Speech hours"], revenue:["Hourly contract","Fixed contract","Other contract rate","Invoiced / collected / outstanding"], labor:["Therapist school hours","Payroll burden","Contract labor","Travel time","Documentation / prep"], expenses:["Mileage / travel","School supplies","Contract-specific costs","District fees"] },
  { number:"3", name:"Private Programs", icon:Waves, tone:"green", unit:["Program location","Program / session"], services:["Swim lessons","DMI / Intensives","Other programs"], revenue:["Cash / card sales","Packages","Discounts","Refunds"], labor:["Instructor / therapist wages","Payroll burden","Contract instructors","Setup / prep time"], expenses:["Program supplies","Pool / facility cost","Equipment","Program marketing"] },
];

function Mark(){return <span className="thrivoli-mark" aria-hidden="true">t</span>}
function Tags({items}:{items:string[]}){return <div className="tree-tags">{items.map(item=><span key={item}>{item}</span>)}</div>}
export function PublicHome(){return <main className="public-home"><Link to="/cheshire" className="public-brand" aria-label="Thrivoli"><Mark/><span>thrivoli</span></Link></main>}

export function CheshireProject(){
  const [active,setActive]=useState<string|null>(null);
  return <main className="tree-page"><section className="tree-canvas" aria-label="Cheshire profitability model">
    <div className="tree-root"><strong>Profitability Map</strong></div>
    <div className="tree-connector" aria-hidden="true"/>
    <div className="tree-columns">{segments.map(segment=><article className={`tree-card ${segment.tone} ${active&&active!==segment.name?"is-muted":""} ${active===segment.name?"is-active":""}`} key={segment.name}>
      <button className="tree-card-header" type="button" aria-pressed={active===segment.name} onClick={()=>setActive(active===segment.name?null:segment.name)}><span className="tree-number">{segment.number}</span><segment.icon size={21} aria-hidden="true"/><h2>{segment.name}</h2><span className="focus-hint">{active===segment.name?"Show all":"Focus"}</span></button>
      <section className="tree-row unit"><h3>Reporting unit</h3><Tags items={segment.unit}/></section>
      <section className="tree-row revenue"><h3>Revenue subcategories</h3><Tags items={segment.services}/></section>
      <section className="tree-row revenue-source"><h3>Revenue source</h3><Tags items={segment.revenue}/></section>
      <section className="tree-row cost"><h3>Direct labor</h3><Tags items={segment.labor}/></section>
      <section className="tree-row cost"><h3>Direct operating expenses</h3><Tags items={segment.expenses}/></section>
    </article>)}</div>
    <section className="tree-bottom"><div className="shared-costs"><h2>Shared overhead <small>allocated using a documented driver</small></h2><Tags items={["Administrative labor","Billing & software","Insurance & professional fees","Corporate G&A"]}/></div><div className="profit-output"><span>Dashboard views</span><strong>Location · Contract · Therapist · Service line</strong><small>Revenue · Contribution margin · Operating profit · Utilization · Break-even</small></div></section>
  </section></main>
}
