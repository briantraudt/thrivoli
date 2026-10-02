/** Source-grained cumulative reports. No monthly allocation or accounting profit inference. */
import { INTAKE_LOCATIONS } from './cheshire-intake.ts';
export const CUMULATIVE_VERSION='cheshire-cumulative-v1';
export const CUMULATIVE_KINDS=['insurance_service_cohort','provider_posted_payments','facility_reported_activity'] as const;
export type CumulativeKind=typeof CUMULATIVE_KINDS[number];
export type CumulativeScope='all'|typeof INTAKE_LOCATIONS[number];
export type Therapy='OT'|'PT'|'ST';
export type CumulativeValues=Record<string,number>;
export type SourceCoordinate={sheet:string;row:number;range:string};
export type CumulativeRow={source:SourceCoordinate;location:string|null;therapy:Therapy|null;provider:string|null;payer:string|null;insurance_group:string|null;values:CumulativeValues};
export type CumulativeReport={
 version:typeof CUMULATIVE_VERSION;kind:CumulativeKind;currency:'USD';currency_note:string;
 source:{filename:string;sha256:string;library_file_id:string;library_version:number;byte_size:number;report_title:string;date_label:string;generated_at:null;validated_at:string};
 period:{start:string;end:string;basis:'service_date_cohort'|'payment_posting_date'|'unresolved_title_filter'};
 rows:CumulativeRow[];totals:CumulativeValues;control_total:{source:SourceCoordinate;values:CumulativeValues}|null;
 unposted:{location:string;value:number|null;source:SourceCoordinate}[];warnings:string[];
};
const measures={insurance_service_cohort:['visits','insurance_payments','patient_payments','total_payments'],provider_posted_payments:['insurance_payments','patient_payments','total_payments'],facility_reported_activity:['charges','insurance_payments','patient_payments','total_payments','insurance_adjustments','patient_adjustments','total_adjustments']} as const;
const bases={insurance_service_cohort:'service_date_cohort',provider_posted_payments:'payment_posting_date',facility_reported_activity:'unresolved_title_filter'} as const;
const HASH=/^[a-f0-9]{64}$/;const DATE=/^\d{4}-\d{2}-\d{2}$/;
function keysOnly(value:Record<string,unknown>,allowed:readonly string[]){return Object.keys(value).length===allowed.length&&Object.keys(value).every(key=>allowed.includes(key));}
function object(value:unknown):value is Record<string,unknown>{return Boolean(value)&&typeof value==='object'&&!Array.isArray(value);}
function text(value:unknown,max=250):value is string{return typeof value==='string'&&value.trim().length>0&&value.length<=max;}
function date(value:unknown):value is string{return typeof value==='string'&&DATE.test(value)&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;}
function coordinate(value:unknown):value is SourceCoordinate{return object(value)&&keysOnly(value,['sheet','row','range'])&&text(value.sheet,100)&&Number.isSafeInteger(value.row)&&Number(value.row)>0&&Number(value.row)<=100000&&text(value.range,60)&&/^[A-Z]+\d+(?::[A-Z]+\d+)?$/.test(String(value.range));}
function sum(rows:CumulativeRow[],keys:readonly string[]){const totals:CumulativeValues={};for(const key of keys){const value=rows.reduce((total,row)=>total+row.values[key],0);if(!Number.isSafeInteger(value))throw new Error('Cumulative total exceeds exact range');totals[key]=value;}return totals;}
function values(value:unknown,keys:readonly string[]):value is CumulativeValues{return object(value)&&Object.keys(value).length===keys.length&&keys.every(key=>Number.isSafeInteger(value[key]))&&(!keys.includes('visits')||Number(value.visits)>=0);}
export function parseCumulativeReport(input:unknown,expectedHash?:string):CumulativeReport{
 if(!object(input)||input.version!==CUMULATIVE_VERSION||!CUMULATIVE_KINDS.includes(input.kind as CumulativeKind))throw new Error('Unrecognized cumulative report');
 if(!keysOnly(input,['version','kind','currency','currency_note','source','period','rows','totals','control_total','unposted','warnings']))throw new Error('Unexpected cumulative fields');
 const r=input as unknown as CumulativeReport;const keys=measures[r.kind];
 if(r.currency!=='USD'||!text(r.currency_note,500)||!object(r.source)||!keysOnly(r.source,['filename','sha256','library_file_id','library_version','byte_size','report_title','date_label','generated_at','validated_at'])||!text(r.source.filename,160)||!HASH.test(r.source.sha256)||expectedHash&&r.source.sha256!==expectedHash||!/^libfile_[a-zA-Z0-9]+$/.test(r.source.library_file_id)||!Number.isSafeInteger(r.source.library_version)||r.source.library_version<0||!Number.isSafeInteger(r.source.byte_size)||r.source.byte_size<1||r.source.byte_size>5242880||!text(r.source.report_title)||!text(r.source.date_label)||r.source.generated_at!==null||!text(r.source.validated_at,50)||!Number.isFinite(Date.parse(r.source.validated_at)))throw new Error('Invalid cumulative source provenance');
 if(!object(r.period)||!keysOnly(r.period,['start','end','basis'])||!date(r.period.start)||!date(r.period.end)||r.period.start.slice(5)!=='01-01'||r.period.start.slice(0,4)!==r.period.end.slice(0,4)||r.period.end<r.period.start||r.period.basis!==bases[r.kind])throw new Error('Invalid cumulative period or basis');
 if(!Array.isArray(r.rows)||!r.rows.length||r.rows.length>1000||!values(r.totals,keys)||!Array.isArray(r.warnings)||r.warnings.length>20||r.warnings.some(warning=>!text(warning,1500))||!Array.isArray(r.unposted))throw new Error('Invalid cumulative report shape');
 const coords=new Set<string>(),dimensions=new Set<string>();
 for(const row of r.rows){
  if(!object(row)||!keysOnly(row,['source','location','therapy','provider','payer','insurance_group','values'])||!coordinate(row.source)||!values(row.values,keys))throw new Error('Invalid cumulative leaf');
  const sourceKey=`${row.source.sheet}:${row.source.row}`;if(coords.has(sourceKey))throw new Error('Duplicate cumulative source row');coords.add(sourceKey);
  if(row.values.insurance_payments+row.values.patient_payments!==row.values.total_payments||!Number.isSafeInteger(row.values.total_payments))throw new Error('Payment components do not reconcile');
  if(r.kind==='provider_posted_payments'){
   if(!text(row.provider,160)||row.location!==null||row.therapy!==null||row.payer!==null||row.insurance_group!==null)throw new Error('Provider collections cannot acquire unsupported location or therapy');
  }else{
   if(!INTAKE_LOCATIONS.includes(row.location as never)||!['OT','PT','ST'].includes(row.therapy as string)||row.provider!==null)throw new Error('Invalid cumulative location/therapy');
   if(r.kind==='insurance_service_cohort'&&(!text(row.payer,160)||!text(row.insurance_group,160)))throw new Error('Missing payer source dimension');
   if(r.kind==='facility_reported_activity'&&(row.payer!==null||row.insurance_group!==null||row.values.insurance_adjustments+row.values.patient_adjustments!==row.values.total_adjustments))throw new Error('Invalid facility source components');
  }
  const dimension=JSON.stringify([row.location,row.therapy,row.provider,row.payer,row.insurance_group]);if(dimensions.has(dimension))throw new Error('Duplicate cumulative dimensions');dimensions.add(dimension);
 }
 const derived=sum(r.rows,keys);if(keys.some(key=>derived[key]!==r.totals[key]))throw new Error('Cumulative leaf totals do not reconcile');
 if(r.kind==='insurance_service_cohort'){if(r.control_total!==null)throw new Error('Service cohort has derived totals, not a printed control total');}
 else if(!object(r.control_total)||!keysOnly(r.control_total,['source','values'])||!coordinate(r.control_total.source)||!values(r.control_total.values,keys)||keys.some(key=>r.control_total!.values[key]!==derived[key]))throw new Error('Printed cumulative control total does not reconcile');
 if(r.kind!=='facility_reported_activity'&&r.unposted.length)throw new Error('Unexpected unposted values');
 const unpostedLocations=new Set<string>();for(const row of r.unposted){if(!object(row)||!keysOnly(row,['location','value','source'])||!INTAKE_LOCATIONS.includes(row.location as never)||unpostedLocations.has(row.location)||row.value!==null&&!Number.isSafeInteger(row.value)||!coordinate(row.source))throw new Error('Invalid facility-only unposted amount');unpostedLocations.add(row.location);}
 if(r.kind==='facility_reported_activity'&&(r.unposted.length!==7||unpostedLocations.size!==7))throw new Error('Incomplete facility-only unposted provenance');
 return r;
}
export function cumulativeScopeTotals(report:CumulativeReport,scope:CumulativeScope,therapy:Therapy|'all'='all'){
 if(report.kind==='provider_posted_payments'&&(scope!=='all'||therapy!=='all'))return null;
 const rows=report.rows.filter(row=>(scope==='all'||row.location===scope)&&(therapy==='all'||row.therapy===therapy));
 return rows.length?sum(rows,measures[report.kind]):null;
}
export function cumulativeReportsForPeriod(reports:CumulativeReport[],mode:'mtd'|'ytd',month:string){
 if(mode!=='ytd'||!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))return[];
 const applicable=reports.filter(report=>report.period.start===`${month.slice(0,4)}-01-01`&&report.period.end.slice(0,7)<=month);
 // Multiple retained versions are not independent flows. Ambiguous same-endpoint reports fail closed.
 return CUMULATIVE_KINDS.flatMap(kind=>{const candidates=applicable.filter(report=>report.kind===kind).sort((a,b)=>b.period.end.localeCompare(a.period.end));const latest=candidates[0];if(!latest)return[];const same=candidates.filter(report=>report.period.end===latest.period.end);return new Set(same.map(report=>report.source.sha256)).size===1?[latest]:[];});
}
export function cumulativeRevenueSummary(reports:CumulativeReport[],scope:CumulativeScope){
 // Pick one family for the whole view, then scope it. A location must never switch basis.
 const report=reports.find(item=>item.kind==='facility_reported_activity')??reports.find(item=>item.kind==='insurance_service_cohort')??reports.find(item=>item.kind==='provider_posted_payments');
 if(!report)return null;
 const total=cumulativeScopeTotals(report,scope);
 const label=report.kind==='facility_reported_activity'?'Cumulative reported payments · date basis unconfirmed':report.kind==='insurance_service_cohort'?'Service-cohort payments · not period cash receipts':'Provider collections · payment-posting dates';
 return{value:total?.total_payments??null,label,coverage:`${report.period.start}–${report.period.end}`,report};
}
