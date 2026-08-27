import { Building2, GraduationCap, Waves } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import "./cheshire-project.css";
import "./cheshire-workflow.css";
import "./cheshire-layout-fix.css";

type DetailGroup = { label: string; items: string[] };
const segments = [
  {
    number:"1", name:"Clinics", icon:Building2, tone:"blue",
    services:["PT","OT – General","OT – Feeding","Speech"],
    revenue:[
      {label:"Third-party",items:["Commercial insurers","Medicaid"]},
      {label:"Patient / family",items:["Copay / coinsurance","Deductible","Self-pay"]},
    ],
    labor:[
      {label:"Cost components",items:["Wages / salary","Payroll taxes","Benefits","Contract labor"]},
      {label:"Time allocation",items:["Treatment time","Documentation / prep","PTO / nonproductive"]},
    ],
    expenses:["Rent","Utilities","Cleaning / waste","Clinical supplies","Practice Pro / ClaimMD","Equipment / depreciation","Repairs & maintenance"],
  },
  {
    number:"2", name:"Schools", icon:GraduationCap, tone:"orange",
    services:["PT hours","OT hours","Speech hours"],
    revenue:[
      {label:"Contract payer",items:["School district / LEA","Individual school","Other education organization"]},
    ],
    labor:[
      {label:"Cost components",items:["Wages / salary","Payroll taxes","Benefits","Contract labor"]},
      {label:"Time allocation",items:["Service hours","Travel time","Documentation / prep"]},
    ],
    expenses:["Mileage / travel","School supplies","Contract-specific costs","District fees"],
  },
  {
    number:"3", name:"Private Programs", icon:Waves, tone:"green",
    services:["Swim lessons","DMI / Intensives","Other programs"],
    revenue:[
      {label:"Customer",items:["Patient / family","Program participant"]},
      {label:"Other payer",items:["Third-party sponsor · if applicable"]},
    ],
    labor:[
      {label:"Cost components",items:["Wages / salary","Payroll taxes","Benefits","Contract instructors"]},
      {label:"Time allocation",items:["Program delivery","Setup / prep"]},
    ],
    expenses:["Program supplies","Pool / facility cost","Equipment / depreciation","Program marketing","Merchant processing fees"],
  },
];

function Mark(){return <span className="thrivoli-mark" aria-hidden="true">t</span>}
function Tags({items}:{items:string[]}){return <div className="tree-tags">{items.map(item=><span key={item}>{item}</span>)}</div>}
function GroupedTags({groups}:{groups:DetailGroup[]}){return <Tags items={groups.flatMap(group=>group.items)}/>}
export function PublicHome(){return <main className="public-home"><Link to="/cheshire" className="public-brand" aria-label="Thrivoli"><Mark/><span>thrivoli</span></Link></main>}

export function CheshireProject(){
  const [active,setActive]=useState<string|null>(null);
  return <main className="tree-page"><section className="tree-canvas" aria-label="Cheshire profitability model">
    <div className="tree-top">
      <div className="tree-root"><strong>Profitability Map</strong></div>
      <div className="tree-legend" aria-label="Color legend"><span className="revenue-key">Revenue</span><span className="expense-key">Expenses</span><span className="overhead-key">Overhead</span></div>
    </div>
    <div className="tree-columns">{segments.map(segment=><article className={`tree-card ${segment.tone} ${active&&active!==segment.name?"is-muted":""} ${active===segment.name?"is-active":""}`} key={segment.name}>
      <button className="tree-card-header" type="button" aria-pressed={active===segment.name} onClick={()=>setActive(active===segment.name?null:segment.name)}><segment.icon size={21} aria-hidden="true"/><div className="segment-title"><h2>{segment.name}</h2></div></button>
      <section className="tree-row service"><span className="section-type">Service</span><Tags items={segment.services}/></section>
      <section className="tree-row revenue-source"><span className="section-type">Payer</span><GroupedTags groups={segment.revenue}/></section>
      <section className="tree-row cost"><span className="section-type expense-type">Expense · Labor</span><GroupedTags groups={segment.labor}/></section>
      <section className="tree-row cost"><span className="section-type expense-type">Expense · Operations</span><Tags items={segment.expenses}/></section>
    </article>)}</div>
    <section className="tree-bottom"><div className="shared-costs"><h2>Allocate shared overhead <small>direct trace first; allocate only truly shared costs</small></h2><Tags items={["Administrative labor","Management leadership","QuickBooks / ADP","Insurance & professional fees","Corporate G&A"]}/></div></section>
  </section></main>
}
