import { Building2, GraduationCap, Waves } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "./cheshire-project.css";
import "./cheshire-workflow.css";
import "./cheshire-layout-fix.css";

type SegmentContent={services:string[];revenue:string[];labor:string[];expenses:string[]};
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
      revenue:["Commercial insurers","Medicaid","Copay / coinsurance","Deductible","Self-pay"],
      labor:["Wages / salary","Payroll taxes","Benefits","Contract labor","Treatment time","Documentation / prep","PTO / nonproductive"],
      expenses:["Rent","Utilities","Cleaning / waste","Clinical supplies","Practice Pro / ClaimMD","Equipment / depreciation","Repairs & maintenance"],
    },
    {
      services:requiredServices,
      revenue:["School district / LEA","Individual school","Other education organization"],
      labor:["Wages / salary","Payroll taxes","Benefits","Contract labor","Service hours","Travel time","Documentation / prep"],
      expenses:["Mileage / travel","School supplies","Contract-specific costs","District fees"],
    },
    {
      services:[...requiredServices,"Swim lessons","Other programs"],
      revenue:["Patient / family","Program participant","Third-party sponsor · if applicable"],
      labor:["Wages / salary","Payroll taxes","Benefits","Contract instructors","Program delivery","Setup / prep"],
      expenses:["Program supplies","Pool / facility cost","Equipment / depreciation","Program marketing","Merchant processing fees"],
    },
  ],
  overhead:["Administrative labor","Management leadership","QuickBooks / ADP","Insurance & professional fees","Corporate G&A"],
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
        return {...parsed,overhead:clean(parsed.overhead),segments:parsed.segments.map(segment=>{
          const migrated=clean(segment.services).map(service=>aliases[service]??service);
          return {...segment,services:[...new Set([...migrated,...requiredServices])],revenue:clean(segment.revenue),labor:clean(segment.labor),expenses:clean(segment.expenses)};
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
    <div className="tree-columns">{segmentMeta.map((segment,index)=>{const content=model.segments[index];return <article className={`tree-card ${segment.tone} ${active&&active!==segment.name?"is-muted":""} ${active===segment.name?"is-active":""}`} key={segment.name}>
      <button className="tree-card-header" type="button" aria-pressed={active===segment.name} onClick={()=>setActive(active===segment.name?null:segment.name)}><segment.icon size={21} aria-hidden="true"/><div className="segment-title"><h2>{segment.name}</h2></div></button>
      <EditableRow label="Service" tone="service" items={content.services} onChange={items=>updateSegment(index,"services",items)}/>
      <EditableRow label="Payer" tone="revenue-source" items={content.revenue} onChange={items=>updateSegment(index,"revenue",items)}/>
      <EditableRow label="Expense · Labor" tone="cost" items={content.labor} onChange={items=>updateSegment(index,"labor",items)}/>
      <EditableRow label="Expense · Operations" tone="cost" items={content.expenses} onChange={items=>updateSegment(index,"expenses",items)}/>
    </article>})}</div>
    <section className="tree-bottom"><div className="shared-costs"><h2>Overhead</h2><div className="overhead-columns">{overheadColumns.map((items,column)=><div className={"overhead-cell overhead-cell-"+(column+1)} key={column}><EditableTags items={items} onChange={next=>updateOverheadColumn(column,next)} label="Overhead"/></div>)}</div><button className="cell-add" type="button" onClick={()=>setModel(current=>({...current,overhead:[...current.overhead,""]}))}>+ Add</button></div></section>
  </section></main>
}
