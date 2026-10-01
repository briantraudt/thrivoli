import { useEffect, useState } from 'react';
import { cheshireSupabase } from '../lib/cheshireSupabase';
import { useIntake } from './intakeContext';
import { parseMetricResponse, type MetricResponse } from './metrics';
export function useValidatedMetrics(location:string){
 const intake=useIntake();
 const signature=JSON.stringify(intake.documents.map(doc=>[doc.id,doc.content_sha256,doc.status,doc.reviewed_at,doc.supersedes_id]));
 const key=JSON.stringify([intake.month,location,signature,intake.referenceSnapshot?.revisionId,intake.state,intake.busy]);
 const [loaded,setLoaded]=useState<{key:string;state:'ready'|'error';data:MetricResponse|null}|null>(null);
 useEffect(()=>{let active=true;setLoaded(null);if(intake.state!=='ready'||intake.busy)return;
  void cheshireSupabase.functions.invoke('cheshire-intake-review',{body:{operation:'metrics',month:intake.month,location}}).then(({data,error})=>{if(!active)return;if(error||data?.error){setLoaded({key,state:'error',data:null});return;}try{setLoaded({key,state:'ready',data:parseMetricResponse(data?.metrics,intake.month,location)});}catch{setLoaded({key,state:'error',data:null});}}).catch(()=>{if(active)setLoaded({key,state:'error',data:null});});
  return()=>{active=false;};
 },[key,intake.month,intake.state,intake.busy,location]);
 // Hide the previous scope synchronously during render, before the effect for the new scope runs.
 return {state:intake.state!=='ready'||intake.busy?'waiting':loaded?.key===key?loaded.state:'loading',data:intake.state==='ready'&&!intake.busy&&loaded?.key===key?loaded.data:null,month:intake.month} as const;
}
