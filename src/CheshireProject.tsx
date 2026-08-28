import { Building2, GraduationCap, Waves } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "./cheshire-project.css";
import "./cheshire-workflow.css";
import "./cheshire-layout-fix.css";

type SegmentContent={services:string[];activity:string[];revenue:string[];revenueFlow:string[];labor:string[];expenses:string[];locationOverhead:string[]};
type EditableModel={segments:SegmentContent[];overhead:string[]};
const segmentMeta=[
  {name:"Clinics",icon:Building2,tone:"blue"},
  {name:"Schools",icon:GraduationCap,tone:"orange"},
  {name:"Private Programs",icon:Waves,tone:"green"},
];
const requiredServices=[
  "Physical Therapy",
  "Occupational Therapy",
  "Speech Therapy",
  "Feeding Therapy Services",
  "Cage Therapy (Universal Exercise Unit)",
  "Pelvic Floor Therapy",
  "Aquatic Therapy Services",
  "Dynamic Movement Intervention",
];
const defaultModel:EditableModel={
  segments:[
    {
      services:requiredServices,
      activity:["Scheduled visits","Completed visits","Cancellations","No-shows","Evaluations","Follow-ups","Billable units","Productive hours","Available visit slots"],
      revenue:["Commercial insurers","Medicaid","Patient / family","Self-pay"],
      revenueFlow:["Gross charges","Contractual adjustments","Expected reimbursement","Patient responsibility","Net revenue","Cash collected","Outstanding A/R","Denials / write-offs","Refunds / credit balances"],
      labor:["Clinician wages / salary","Payroll taxes","Benefits","Contract / traveler labor","Treatment time","Documentation / prep","PTO / nonproductive","Overtime / differentials"],
      expenses:["Clinical supplies","Equipment rental / maintenance","Laundry / PPE","Merchant processing fees","Outsourced clinical services"],
      locationOverhead:["Rent / lease","CAM / property taxes","Utilities","Cleaning / waste","Front-desk / site administration","Local management","Local marketing","Telecom / internet","Security","Facility repairs","Leasehold amortization"],
    },
    {
      services:requiredServices,
      activity:["Contracted hours","Scheduled hours","Delivered hours","Unfilled hours","Travel hours","Documentation / prep hours"],
      revenue:["School district / LEA","Individual school","Other education organization"],
      revenueFlow:["Earned revenue","Unbilled revenue","Invoiced","Cash collected","Outstanding A/R","Deferred / unearned revenue","Credits / adjustments"],
      labor:["Clinician wages / salary","Payroll taxes","Benefits","Contract labor","Service hours","Travel time","Documentation / prep","PTO / nonproductive","Overtime / differentials"],
      expenses:["Mileage / travel reimbursement","School supplies","Contract-specific costs","District fees","Background checks / credentialing"],
      locationOverhead:["Contract administration","Scheduling / coordination","Local management","Telecom / IT","Local recruiting"],
    },
    {
      services:[...requiredServices,"Swim lessons","Other programs"],
      activity:["Available spots","Enrolled participants","Scheduled sessions","Completed sessions","Cancellations / no-shows","Package redemptions","Pool / facility hours"],
      revenue:["Patient / family","School / community sponsor","Grant / scholarship fund"],
      revenueFlow:["Single-session sales","Package sales","Earned / redeemed revenue","Cash collected","Outstanding balances","Discounts","Refunds","Deferred / unearned revenue"],
      labor:["Instructor / clinician wages","Payroll taxes","Benefits","Contract instructors","Program delivery","Setup / prep","PTO / nonproductive","Overtime / differentials"],
      expenses:["Program supplies","Pool / facility rental","Equipment rental / maintenance","Merchant processing fees","Program-specific vendors"],
      locationOverhead:["Program administration","Local management","Local marketing","Telecom / IT","Facility occupancy","Utilities / cleaning","Leasehold amortization"],
    },
  ],
  overhead:["Executive leadership","Finance / accounting","HR / recruiting","Central billing / RCM","Practice Pro / ClaimMD","QuickBooks / ADP","IT / cybersecurity","Insurance & professional fees","Legal / audit / tax","Corporate marketing","Corporate G&A"],
};
const storageKey="cheshire-profitability-map-v1";

function Mark(){return <span className="thrivoli-mark" aria-hidden="true">t</span>}
function loadModel():EditableModel{
  try{
    const saved=localStorage.getItem(storageKey);
    if(saved){
      const parsed=JSON.parse(saved) as EditableModel;
      if(parsed.segments?.length===3&&Array.isArray(parsed.overhead)){
        const aliases:Record<string,string>={
          "PT":"Physical Therapy","PT hours":"Physical Therapy",
          "OT – General":"Occupational Therapy","OT hours":"Occupational Therapy",
          "OT – Feeding":"Feeding Therapy Services",
          "Speech":"Speech Therapy","Speech hours":"Speech Therapy",
          "DMI / Intensives":"Dynamic Movement Intervention",
        };
        const clean=(items:string[])=>items.map(item=>item==="New item"?"":item);
        return {...parsed,overhead:clean(parsed.overhead),segments:parsed.segments.map((segment,index)=>{
          const migrated=clean(segment.services).map(service=>aliases[service]??service);
          const locationOverhead=Array.isArray(segment.locationOverhead)?clean(segment.locationOverhead):defaultModel.segments[index].locationOverhead;
          const isLegacy=!Array.isArray(segment.activity)||!Array.isArray(segment.revenueFlow);
          const merge=(current:string[]|undefined,recommended:string[])=>[...new Set([...(current?clean(current):[]),...(isLegacy?recommended:[])])];
          return {
            ...segment,
            services:[...new Set([...migrated,...requiredServices])],
            activity:merge(segment.activity,defaultModel.segments[index].activity),
            revenue:merge(segment.revenue,defaultModel.segments[index].revenue),
            revenueFlow:merge(segment.revenueFlow,defaultModel.segments[index].revenueFlow),
            labor:merge(segment.labor,defaultModel.segments[index].labor),
            expenses:merge(segment.expenses,defaultModel.segments[index].expenses),
            locationOverhead:merge(locationOverhead,defaultModel.segments[index].locationOverhead),
          };
        })};
      }
    }
  }catch{/* Use the approved defaults if browser storage is unavailable or invalid. */}
  return defaultModel;
}
function EditableTags({items,onChange,label}:{items:string[];onChange:(items:string[])=>void;label:string}){
  return <div className="tree-tags editable-tags">{items.map((item,index)=><span className="editable-chip" key={index}>
    <input aria-label={`Edit ${label} item ${index+1}`} value={item} placeholder="New item" autoFocus={item===""&&index===items.length-1} size={Math.max(8,item.length||8)}
      onChange={event=>onChange(items.map((value,itemIndex)=>itemIndex===index?event.target.value:value))}
      onKeyDown={event=>{if(event.key==="Enter"){event.preventDefault();event.currentTarget.blur()}}}
      onBlur={event=>{const value=event.currentTarget.value.trim();if(!value)onChange(items.filter((_,itemIndex)=>itemIndex!==index));else if(value!==item)onChange(items.map((current,itemIndex)=>itemIndex===index?value:current))}}/>
    <button type="button" aria-label={`Delete ${item||label} item`} title="Delete item" onClick={()=>onChange(items.filter((_,itemIndex)=>itemIndex!==index))}>×</button>
  </span>)}</div>
}
function EditableRow({label,items,tone,onChange}:{label:string;items:string[];tone:string;onChange:(items:string[])=>void}){
  return <section className={`tree-row ${tone}`}><span className="section-type">{label}</span><EditableTags items={items} onChange={onChange} label={label}/><button className="cell-add" type="button" onClick={()=>onChange([...items,""])}>+ Add</button></section>
}
export function PublicHome(){return <main className="public-home"><Link to="/cheshire" className="public-brand" aria-label="Thrivoli"><Mark/><span>thrivoli</span></Link></main>}

export function CheshireProject(){
  const [active,setActive]=useState<string|null>(null);
  const [model,setModel]=useState<EditableModel>(loadModel);
  useEffect(()=>{try{localStorage.setItem(storageKey,JSON.stringify(model))}catch{/* Editing still works for this session. */}},[model]);
  const updateSegment=(segmentIndex:number,key:keyof SegmentContent,items:string[])=>setModel(current=>({
    ...current,segments:current.segments.map((segment,index)=>index===segmentIndex?{...segment,[key]:items}:segment),
  }));
  const overheadColumns=[0,1,2].map(column=>model.overhead.filter((_,index)=>index%3===column));
  const updateOverheadColumn=(columnIndex:number,items:string[])=>setModel(current=>{
    const columns=[0,1,2].map(column=>current.overhead.filter((_,index)=>index%3===column));
    columns[columnIndex]=items;
    const overhead:string[]=[];
    const rowCount=Math.max(...columns.map(column=>column.length));
    for(let row=0;row<rowCount;row++)for(let column=0;column<3;column++)if(columns[column][row]!==undefined)overhead.push(columns[column][row]);
    return {...current,overhead};
  });
  return <main className="tree-page"><section className="tree-canvas" aria-label="Cheshire profitability model">
    <div className="tree-top">
      <div className="tree-root"><strong>Profitability Map</strong></div>
      <div className="tree-legend" aria-label="Color legend"><span className="revenue-key">Revenue</span><span className="expense-key">Expenses</span><span className="overhead-key">Overhead</span></div>
    </div>
    <div className="map-frame"><div className="tree-columns">{segmentMeta.map((segment,index)=>{const content=model.segments[index];return <article className={`tree-card ${segment.tone} ${active&&active!==segment.name?"is-muted":""} ${active===segment.name?"is-active":""}`} key={segment.name}>
      <button className="tree-card-header" type="button" aria-pressed={active===segment.name} onClick={()=>setActive(active===segment.name?null:segment.name)}><segment.icon size={21} aria-hidden="true"/><div className="segment-title"><h2>{segment.name}</h2></div></button>
      <EditableRow label="Service" tone="service" items={content.services} onChange={items=>updateSegment(index,"services",items)}/>
      <EditableRow label="Volume & Capacity" tone="activity" items={content.activity} onChange={items=>updateSegment(index,"activity",items)}/>
      <EditableRow label="Payer" tone="revenue-source" items={content.revenue} onChange={items=>updateSegment(index,"revenue",items)}/>
      <EditableRow label="Revenue Flow" tone="revenue-flow" items={content.revenueFlow} onChange={items=>updateSegment(index,"revenueFlow",items)}/>
      <EditableRow label="Expense · Labor" tone="cost" items={content.labor} onChange={items=>updateSegment(index,"labor",items)}/>
      <EditableRow label="Expense · Operations" tone="cost" items={content.expenses} onChange={items=>updateSegment(index,"expenses",items)}/>
      <EditableRow label="Location Overhead" tone="location-overhead" items={content.locationOverhead} onChange={items=>updateSegment(index,"locationOverhead",items)}/>
    </article>})}</div>
    <section className="tree-bottom"><div className="shared-costs"><h2>Centralized Shared Overhead</h2><div className="overhead-columns">{overheadColumns.map((items,column)=><div className={"overhead-cell overhead-cell-"+(column+1)} key={column}><EditableTags items={items} onChange={next=>updateOverheadColumn(column,next)} label="Centralized Shared Overhead"/></div>)}</div><button className="cell-add" type="button" onClick={()=>setModel(current=>({...current,overhead:[...current.overhead,""]}))}>+ Add</button></div></section></div>
  </section></main>
}
