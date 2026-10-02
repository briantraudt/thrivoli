import { useEffect, useRef, useState } from 'react';
import { cheshireSupabase } from '../lib/cheshireSupabase';
import { useIntake } from './intakeContext';
import { parseMetricResponse, type MetricResponse } from './metrics';
import { createRequestQueue, reportingMonths, type PeriodMode } from './periodSummary';
import type { MapCategory, SheetScope } from './profitabilitySheet';
type Loaded={key:string;responses:Partial<Record<string,MetricResponse>>;categories:MapCategory[];failedMonths:string[];mapError:boolean};
const MAX_AGE=30_000;
export function useProfitabilityPeriod(mode:PeriodMode,scope:SheetScope){
  const intake=useIntake();const months=reportingMonths(mode,intake.month);
  const sourceVersion=JSON.stringify([intake.documents.map(doc=>[doc.id,doc.content_sha256,doc.status,doc.reviewed_at,doc.review_revision,doc.validation_dependency_revisions,doc.supersedes_id]),intake.referenceSnapshot?.revisionId,intake.state,intake.busy]);
  const key=JSON.stringify([mode,intake.month,scope,sourceVersion]);
  const cache=useRef<{version:string;values:Map<string,{at:number;data:MetricResponse}>}>({version:'',values:new Map()});
  const queue=useRef(createRequestQueue(3));const[loaded,setLoaded]=useState<Loaded|null>(null);
  useEffect(()=>{
    let active=true;setLoaded(null);
    if(cache.current.version!==sourceVersion){cache.current={version:sourceVersion,values:new Map()};}
    if(intake.state!=='ready'||intake.busy){cache.current.values.clear();return;}
    const current=()=>active&&cache.current.version===sourceVersion;
    const requests=reportingMonths(mode,intake.month).map(async month=>{
      const cacheKey=`${month}:${scope}`;const saved=cache.current.values.get(cacheKey);
      if(saved&&Date.now()-saved.at<MAX_AGE)return{month,data:saved.data};
      try{const data=await queue.current.run(async()=>{const result=await cheshireSupabase.functions.invoke('cheshire-intake-review',{body:{operation:'metrics',month,location:scope}});if(result.error||result.data?.error)throw new Error('Source unavailable');return parseMetricResponse(result.data?.metrics,month,scope);},current);
        if(data&&current()){cache.current.values.set(cacheKey,{at:Date.now(),data});if(cache.current.values.size>24)cache.current.values.delete(cache.current.values.keys().next().value!);}return{month,data};
      }catch{return{month,data:null};}
    });
    void Promise.all([Promise.all(requests),cheshireSupabase.from('cheshire_chip').select('category,value,segment_index,position').order('position')]).then(([responses,map])=>{
      if(!current())return;
      const validMap=!map.error&&Array.isArray(map.data)&&map.data.length<=500&&map.data.every(row=>typeof row.value==='string'&&row.value.length<=500&&['services','revenue','labor','expenses','locationOverhead','overhead'].includes(row.category)&&(row.segment_index===null||[0,1,2].includes(row.segment_index))&&Number.isFinite(row.position));
      setLoaded({key,responses:Object.fromEntries(responses.filter(row=>row.data).map(row=>[row.month,row.data!])),failedMonths:responses.filter(row=>!row.data).map(row=>row.month),categories:validMap?map.data as MapCategory[]:[],mapError:!validMap});
    }).catch(()=>{if(current())setLoaded({key,responses:{},failedMonths:reportingMonths(mode,intake.month),categories:[],mapError:true});});
    return()=>{active=false;};
  },[key,sourceVersion,intake.state,intake.busy,intake.month,mode,scope]);
  const current=intake.state==='ready'&&!intake.busy&&loaded?.key===key?loaded:null;
  return{months,scope,responses:current?.responses??{},categories:current?.categories??[],failedMonths:current?.failedMonths??[],mapError:current?.mapError??false,state:intake.state!=='ready'||intake.busy?'waiting':current?'ready':'loading'}as const;
}
