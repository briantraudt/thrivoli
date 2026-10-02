import {parseCumulativeReport,cumulativeReportsForPeriod,type CumulativeReport} from '../../supabase/functions/_shared/cheshire-cumulative.ts';
import type {IntakeDocument} from './intake';
/** Only reviewed existing-source facts are eligible. These never complete a monthly checklist. */
export function readCumulativeReports(documents:IntakeDocument[],mode:'mtd'|'ytd',month:string):CumulativeReport[]{
 const superseded=new Set(documents.map(doc=>doc.supersedes_id).filter(Boolean));
 const reports=documents.flatMap(doc=>{
  if(superseded.has(doc.id)||doc.source_origin!=='existing_source'||doc.status!=='incomplete'||doc.validation?.validator_version!=='source-audit-v1'||doc.requested_month!==null||doc.reported_month!==null||doc.storage_path!==null||!doc.validation.cumulative_report)return[];
  try{return[parseCumulativeReport(doc.validation.cumulative_report,doc.content_sha256)];}catch{return[];}
 });
 return cumulativeReportsForPeriod(reports,mode,month);
}
export function reportPeriod(report:CumulativeReport){const fmt=(date:string)=>new Date(date+'T12:00:00Z').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'});return `${fmt(report.period.start)} – ${fmt(report.period.end)}`;}
