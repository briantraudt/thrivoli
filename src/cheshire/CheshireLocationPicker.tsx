import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { Building2, Check, ChevronDown } from 'lucide-react';
import { LOCATIONS } from './finance';
import type { SheetScope } from './profitabilitySheet';

const options: {value:SheetScope;label:string}[]=[{value:'all',label:'All locations'},...LOCATIONS.map(value=>({value,label:value}))];
export function CheshireLocationPicker({value,onChange}:{value:SheetScope;onChange:(value:SheetScope)=>void}){
 const[open,setOpen]=useState(false);const[active,setActive]=useState(0);const root=useRef<HTMLDivElement>(null);const trigger=useRef<HTMLButtonElement>(null);const list=useRef<HTMLUListElement>(null);const search=useRef({text:'',at:0});const id=useId();
 const selected=options.findIndex(option=>option.value===value);
 const close=(returnFocus=false)=>{setOpen(false);if(returnFocus)trigger.current?.focus();};
 const show=()=>{setActive(Math.max(0,selected));search.current={text:'',at:0};setOpen(true);};
 const choose=(index:number)=>{onChange(options[index].value);close(true);};
 useEffect(()=>{
  if(!open)return;
  list.current?.focus();
  const outside=(event:PointerEvent)=>{if(event.target instanceof Node&&!root.current?.contains(event.target))setOpen(false);};
  document.addEventListener('pointerdown',outside);
  return()=>document.removeEventListener('pointerdown',outside);
 },[open]);
 useEffect(()=>{if(open)list.current?.children?.[active]?.scrollIntoView?.({block:'nearest',inline:'nearest'});},[active,open]);
 const onKeyDown=(event:KeyboardEvent<HTMLUListElement>)=>{
  if(event.key==='Escape'){event.preventDefault();close(true);return;}
  if(event.key==='Tab'){close(true);return;}
  if(event.key==='Enter'||event.key===' '){event.preventDefault();choose(active);return;}
  if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){
   event.preventDefault();setActive(index=>event.key==='Home'?0:event.key==='End'?options.length-1:(index+(event.key==='ArrowDown'?1:-1)+options.length)%options.length);return;
  }
  if(event.key.length===1&&!event.ctrlKey&&!event.metaKey&&!event.altKey){
   event.preventDefault();const now=Date.now();const text=(now-search.current.at<700?search.current.text:'')+event.key.toLowerCase();search.current={text,at:now};const query=[...text].every(char=>char===text[0])?text[0]:text;const start=query.length===1?active+1:active;
   for(let step=0;step<options.length;step++){const index=(start+step)%options.length;if(options[index].label.toLowerCase().startsWith(query)){setActive(index);break;}}
  }
 };
 return <div className="csd-location" ref={root} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget))setOpen(false);}}>
  <button className="csd-location-trigger" ref={trigger} type="button" aria-label="Location" aria-haspopup="listbox" aria-expanded={open} aria-controls={open?id:undefined} onClick={()=>open?close(true):show()} onKeyDown={event=>{if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();show();}}}><Building2 size={16}/><span>{options[selected]?.label??'All locations'}</span><ChevronDown size={14}/></button>
  {open?<ul className="csd-location-menu" id={id} ref={list} role="listbox" aria-label="Location" aria-activedescendant={`${id}-${active}`} tabIndex={-1} onKeyDown={onKeyDown}>{options.map((option,index)=><li id={`${id}-${index}`} key={option.value} role="option" aria-selected={option.value===value} className={index===active?'csd-location-active':undefined} onPointerMove={()=>setActive(index)} onClick={()=>choose(index)}><span>{option.label}</span>{option.value===value?<Check size={16} aria-hidden="true"/>:null}</li>)}</ul>:null}
 </div>;
}
