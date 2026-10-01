/** Deterministic, private normalization. Never pass this module's rows or results to AI. */
import { INTAKE_LOCATIONS, MAX_PAYER_LENGTH, REQUIRED_CHECKS, SOURCE_TYPES, isMonth, canonicalField, type ParsedTable, type ReviewResult, type SourceType } from './cheshire-intake.ts';
export const NORMALIZER_VERSION = 'cheshire-metrics-v1' as const;
export const METRICS = {
  insurance_payments: { label: 'Reported insurance payments', unit: 'USD', scale: 100 },
  patient_payments: { label: 'Reported patient payments', unit: 'USD', scale: 100 },
  charges: { label: 'Reported charges', unit: 'USD', scale: 100 },
  write_offs: { label: 'Reported write-offs', unit: 'USD', scale: 100 },
  adjustments: { label: 'Reported adjustments', unit: 'USD', scale: 100 },
  outstanding_balance: { label: 'Reported outstanding balance', unit: 'USD', scale: 100 },
  completed_visits: { label: 'Completed clinic visits', unit: 'visits', scale: 1 },
  scheduled_visits: { label: 'Scheduled clinic visits', unit: 'visits', scale: 1 },
  cancellations: { label: 'Clinic cancellations', unit: 'visits', scale: 1 },
  no_shows: { label: 'Clinic no-shows', unit: 'visits', scale: 1 },
  clinic_units: { label: 'Clinic activity units', unit: 'units', scale: 1 },
  worked_hours: { label: 'Reported clinic worked hours', unit: 'hours', scale: 10000 },
  school_invoices: { label: 'School invoiced amount', unit: 'USD', scale: 100 },
  school_hours: { label: 'School billed hours', unit: 'hours', scale: 10000 },
  school_visits: { label: 'School billed visits', unit: 'visits', scale: 10000 },
  cash_program_income: { label: 'Reported specialty-program income', unit: 'USD', scale: 100 },
  loaded_payroll: { label: 'Reported loaded payroll cost', unit: 'USD', scale: 100 },
  paid_hours: { label: 'Payroll paid hours', unit: 'hours', scale: 10000 },
  additional_operating_cost: { label: 'Operating costs separate from baseline', unit: 'USD', scale: 100 },
  baseline_overlap_cost: { label: 'Operating costs already in baseline', unit: 'USD', scale: 100 },
  monthly_overhead: { label: 'Uploaded monthly overhead', unit: 'USD', scale: 100 },
} as const;
export type MetricKey = keyof typeof METRICS;
export const BASES = ['payment_date','service_date','report_as_of','invoice_reported_month','program_reported_month','payroll_reported_month','expense_reported_month','overhead_reported_month'] as const;
export type MetricBasis = typeof BASES[number];
export type NormalizedRow = { source_row: number; location: string | null; basis: MetricBasis; payer?:string; measures: Partial<Record<MetricKey, number>> };
export type MetricBatch = { document_id: string; content_sha256: string; reporting_month: string; review_token: string; validator_version: string; normalizer_version: string; validation_dependencies: Record<string,string>; dependency_revisions: Record<string,string>; normalization_issue?:'currency_confirmation'|'ambiguous_reporting_key'|null; rows: NormalizedRow[] };
export type MetricDocument = { id:string;source_type:SourceType;requested_month:string|null;reported_month:string|null;content_sha256:string;status:string;source_origin:string;review_token?:unknown;validation:ReviewResult|null;validation_dependencies?:Record<string,string>|null;supersedes_id?:unknown };
export type PayerSubtotal = {payer:string;value:number;source_rows:number;source_locations:string[]};
export type SourceMetric = { key: MetricKey; label: string; unit: string; scale: number; value: number; basis: MetricBasis; location: string | null; source_locations: string[]; source_rows: number; payer_breakdown?:PayerSubtotal[] };
export type ServedSource = { document_id:string;content_sha256:string;validator_version:string;normalizer_version:string;source_type:SourceType;coverage:'validated_source_scope';location_coverage:string[];metrics:SourceMetric[] };
export type MetricResponse = { month:string;location:string;sources:ServedSource[];blocked:{source_type:SourceType;reason:string}[];profit:{available:false;reason:string};accounting_request:string };
export const ACCOUNTING_REQUEST = 'Confirm the monthly accounting definition (cash collections or accrual/service revenue), reporting cutoff and timezone, and supply matching-period revenue and payroll/expense evidence. School invoices are not proof of cash receipts. Reconcile all cost coverage, overhead blanks and overlaps before profit or margin is calculated.';
const SOURCE_KEYS:Partial<Record<SourceType,MetricKey[]>>={
 insurance_revenue:['insurance_payments','patient_payments','charges','write_offs','adjustments','outstanding_balance'],
 clinic_activity:['completed_visits','scheduled_visits','cancellations','no_shows','clinic_units','worked_hours'],
 school_billing:['school_invoices','school_hours','school_visits'],cash_programs:['cash_program_income'],payroll:['loaded_payroll','paid_hours'],
 operating_expenses:['additional_operating_cost','baseline_overlap_cost'],overhead:['monthly_overhead'],
};
const EXPECTED_BASIS:Partial<Record<SourceType,readonly MetricBasis[]>>={insurance_revenue:['payment_date','service_date','report_as_of'],clinic_activity:['service_date'],school_billing:['invoice_reported_month'],cash_programs:['program_reported_month'],payroll:['payroll_reported_month'],operating_expenses:['expense_reported_month'],overhead:['overhead_reported_month']};
function scaled(raw:string|null|undefined,scale:number,signed=false):number {
 if(raw==null)throw new Error('A normalized measure is missing.');
 const input=raw.replace(/^\((.*)\)$/, '-$1').replace(/^(-?)\$/, '$1');
 if(!/^-?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(input))throw new Error('Invalid normalized number.');
 const clean=input.replaceAll(',','');const negative=clean.startsWith('-');if(negative&&!signed)throw new Error('Negative measure not allowed.');
 const [whole,fraction='']=clean.replace(/^-/,'').split('.');const precision=Math.log10(scale);if(fraction.length>precision)throw new Error('Unexpected numeric precision.');
 const value=Number(whole)*scale+Number(fraction.padEnd(precision,'0'));if(!Number.isSafeInteger(value))throw new Error('Unsafe normalized number.');return negative?-value:value;
}
function total(values:number[]){const result=values.reduce((sum,value)=>sum+value,0);if(!Number.isSafeInteger(result))throw new Error('Aggregate exceeds the exact numeric range.');return result;}
export function verifiedReview(review:ReviewResult|null,month:string){return review?.reference_basis===undefined&&review?.validator_version==='cheshire-intake-v1'&&review.status==='complete'&&review.reported_month===month&&review.missing_items.length===0&&review.checks.length===REQUIRED_CHECKS.length&&REQUIRED_CHECKS.every(key=>review.checks.filter(check=>check.key===key&&check.passed===true).length===1);}
export function normalizationIssue(table:ParsedTable,source:SourceType):'currency_confirmation'|'ambiguous_reporting_key'|null {
 if(['cash_programs','payroll','operating_expenses','overhead'].includes(source)&&table.rows.some(row=>row.currency!=='USD'))return 'currency_confirmation';
 const keys:Partial<Record<SourceType,string[]>>={insurance_revenue:['location','therapist_id','payer','date_basis'],clinic_activity:['location','therapist_id'],cash_programs:['location','program'],school_billing:['district','therapist_id','billing_basis']};
 if(source==='operating_expenses'){const seen=new Set<string>();for(const row of table.rows.filter(row=>row.overhead_overlap==='included_in_baseline')){const key=JSON.stringify([row.location,canonicalField(row.expense_category??'')]);if(seen.has(key))return 'ambiguous_reporting_key';seen.add(key);}}
 const fields=keys[source];if(fields){const seen=new Set<string>();for(const row of table.rows){const key=JSON.stringify(fields.map(field=>row[field]));if(seen.has(key))return 'ambiguous_reporting_key';seen.add(key);}}
 return null;
}
export function normalizeMetrics(table:ParsedTable,source:SourceType,month:string,review:ReviewResult):NormalizedRow[] {
 if(!isMonth(month)||!verifiedReview(review,month))return [];
 if(!SOURCE_KEYS[source]||normalizationIssue(table,source))return []; // Manifest/allocation are evidence, never financial measures.
 return table.rows.map((raw,index)=>{
  if(raw.reporting_month!==month)throw new Error('A normalized source has a different reporting month.');
  const row:NormalizedRow={source_row:table.sourceRows[index],location:raw.location??null,basis:EXPECTED_BASIS[source]![0],measures:{}};
  const add=(key:MetricKey,field:string=key)=>{row.measures[key]=scaled(raw[field],METRICS[key].scale,key==='adjustments');};
  switch(source){
   case 'insurance_revenue':row.basis=raw.date_basis as MetricBasis;row.payer=raw.payer??undefined;for(const key of SOURCE_KEYS[source]!)add(key);break;
   case 'clinic_activity':for(const key of SOURCE_KEYS[source]!)add(key,key==='clinic_units'?'units':key);break;
   case 'school_billing':add('school_invoices','invoice_total');add(raw.billing_basis==='hours'?'school_hours':'school_visits','billed_quantity');break;
   case 'cash_programs':add('cash_program_income','income');break;
   case 'payroll':row.measures.loaded_payroll=total((raw.payroll_cost_basis==='disjoint_components'?['cash_pay','payroll_taxes','benefits','pto_cost','bonuses']:['cash_pay','payroll_taxes','benefits']).map(key=>scaled(raw[key],100)));add('paid_hours');break;
   case 'operating_expenses':add(raw.overhead_overlap==='included_in_baseline'?'baseline_overlap_cost':'additional_operating_cost','allocated_amount');break;
   case 'overhead':add('monthly_overhead','amount');break;
  }
  assertRow(row,source);return row;
 });
}
function assertRow(row:NormalizedRow,source:SourceType){
 if(!Number.isInteger(row.source_row)||row.source_row<2||row.source_row>10001||!EXPECTED_BASIS[source]?.includes(row.basis))throw new Error('Invalid metric provenance.');
 if(['payroll','school_billing'].includes(source)?row.location!==null:!INTAKE_LOCATIONS.includes(row.location as never))throw new Error('Invalid metric location.');
 if(source==='insurance_revenue'&&(typeof row.payer!=='string'||!row.payer.trim()||row.payer!==row.payer.trim()||row.payer.length>MAX_PAYER_LENGTH))throw new Error('A bounded source payer is required.');
 if(source!=='insurance_revenue'&&row.payer!==undefined)throw new Error('Unexpected payer attribution.');
 const keys=Object.keys(row.measures) as MetricKey[];
 const expected=SOURCE_KEYS[source];if(!expected||!keys.length||keys.some(key=>!expected.includes(key)||!Number.isSafeInteger(row.measures[key])||((row.measures[key]??0)<0&&key!=='adjustments')))throw new Error('Invalid metric measures.');
 const required=source==='school_billing'?['school_invoices']:source==='operating_expenses'?[]:expected;
 if(required.some(key=>!keys.includes(key as MetricKey)))throw new Error('Missing normalized measure.');
 if(source==='school_billing'&&(keys.length!==2||Number(keys.includes('school_hours'))+Number(keys.includes('school_visits'))!==1))throw new Error('School unit ambiguity.');
 if(source==='operating_expenses'&&keys.length!==1)throw new Error('Overlapping operating measures.');
}
function monthOf(value:string|null){return value?.slice(0,7);}
function complete(doc:MetricDocument,month:string){return doc.source_origin==='portal_upload'&&doc.status==='complete'&&monthOf(doc.requested_month)===month&&monthOf(doc.reported_month)===month&&verifiedReview(doc.validation,month);}
export function dependencyRevision(doc:MetricDocument){return typeof doc.review_token==='string'?doc.review_token:null;}
const dependenciesFor=(source:SourceType):SourceType[]=>['insurance_revenue','clinic_activity','school_billing','cash_programs','payroll','operating_expenses'].includes(source)?['coverage_manifest']:source==='staff_allocation'?['coverage_manifest','payroll']:[];
function equalMap(a:Record<string,string>,b:Record<string,string>){return JSON.stringify(Object.entries(a).sort())===JSON.stringify(Object.entries(b).sort());}
/** Consumes one database snapshot. Never emits raw rows, staff IDs, filenames or AI content. */
export function serveMetrics(input:{documents:MetricDocument[];batches:MetricBatch[];overhead_revision:string|null},month:string,location='all'):MetricResponse {
 if(!isMonth(month)||(location!=='all'&&!INTAKE_LOCATIONS.includes(location as never)))throw new Error('Invalid metric scope.');
 if(!Array.isArray(input.documents)||!Array.isArray(input.batches)||input.documents.length>=250||input.batches.length>=250)throw new Error('Metric source inventory needs reconciliation.');
 const docs=input.documents.filter(doc=>monthOf(doc.requested_month)===month);
 const superseded=new Set(docs.map(doc=>doc.supersedes_id).filter(Boolean));const active=docs.filter(doc=>!superseded.has(doc.id)&&!(doc.source_type==='overhead'&&doc.validation?.reference_basis==='fixed_monthly_baseline'));
 const current=(source:SourceType)=>{const found=active.filter(doc=>doc.source_type===source);return found.length===1&&complete(found[0],month)?found[0]:null;};
 const result:MetricResponse={month,location,sources:[],blocked:[],profit:{available:false,reason:'A shared revenue/cost accounting basis and complete matching-scope cost coverage have not been reconciled.'},accounting_request:ACCOUNTING_REQUEST};
 for(const source of SOURCE_TYPES.filter(source=>SOURCE_KEYS[source])){
  const candidates=active.filter(doc=>doc.source_type===source);if(!candidates.length)continue;
  const doc=current(source);let reason=!doc?(candidates.length>1?'Multiple active files need overlap and combined-scope reconciliation.':'This source is awaiting complete same-month validation.') : '';
  if(doc){
   const matching=input.batches.filter(batch=>batch.document_id===doc.id&&batch.review_token===doc.review_token);
   const batch=matching.length===1?matching[0]:null;
   if(!batch||batch.content_sha256!==doc.content_sha256||monthOf(batch.reporting_month)!==month||batch.validator_version!==doc.validation?.validator_version||batch.normalizer_version!==NORMALIZER_VERSION||!equalMap(batch.validation_dependencies,doc.validation_dependencies??{}))reason='Recheck this validated upload to produce its current metric version.';
   if(!reason&&batch){
    for(const depKind of [...new Set([...dependenciesFor(source),...Object.keys(batch.dependency_revisions) as SourceType[]])]){
     const dep=current(depKind);if(!dep||doc.validation_dependencies?.[depKind]!==`${dep.id}:${dep.content_sha256}`||batch.dependency_revisions[depKind]!==dependencyRevision(dep))reason='A supporting source changed or is unavailable. Recheck this upload after the supporting source is validated.';
    }
    if(source==='operating_expenses'&&(!input.overhead_revision||doc.validation_dependencies?.overhead_reference!==input.overhead_revision))reason='The overhead reference changed or is unavailable. Reconcile expense overlap again.';
    if(!reason&&batch.normalization_issue)reason=batch.normalization_issue==='currency_confirmation'?'Add an explicit currency column with USD to this aggregate export before monetary metrics can be displayed.':'Repeated reporting keys need reconciliation before these rows can be added without overlap.';
    if(!reason){
     if(!Array.isArray(batch.rows)||!batch.rows.length||batch.rows.length>10000||batch.rows.length!==doc.validation?.row_count)throw new Error('Invalid metric batch row count.');
     const seen=new Set<number>();const groups=new Map<string,SourceMetric>();
     for(const row of batch.rows){assertRow(row,source);if(seen.has(row.source_row))throw new Error('Duplicate metric provenance.');seen.add(row.source_row);
      if(location!=='all'&&row.location!==location)continue;
      for(const key of Object.keys(row.measures) as MetricKey[]){const group=JSON.stringify([key,row.basis]);const existing=groups.get(group);const meta=METRICS[key];
       const payerBreakdown=existing?.payer_breakdown?[...existing.payer_breakdown]:[];
       if(row.payer){const index=payerBreakdown.findIndex(item=>item.payer===row.payer);const prior=index<0?null:payerBreakdown[index];const subtotal={payer:row.payer,value:total([prior?.value??0,row.measures[key]!]),source_rows:(prior?.source_rows??0)+1,source_locations:[...new Set([...(prior?.source_locations??[]),...(row.location?[row.location]:[])])]};if(index<0)payerBreakdown.push(subtotal);else payerBreakdown[index]=subtotal;}
       groups.set(group,{key,label:meta.label,unit:meta.unit,scale:meta.scale,value:total([existing?.value??0,row.measures[key]!]),basis:row.basis,location:location==='all'?null:location,source_locations:[...new Set([...(existing?.source_locations??[]),...(row.location?[row.location]:[])])],source_rows:(existing?.source_rows??0)+1,...(row.payer?{payer_breakdown:payerBreakdown}: {})});}
     }
     if(!groups.size&&location!=='all'){reason='No source-supported location allocation is available for this metric.';}
     else if([...groups.values()].some(metric=>(metric.payer_breakdown?.length??0)>100))reason='More than 100 payer identifiers need a reconciled aggregate payer scope before dashboard display.';
     else result.sources.push({document_id:doc.id,content_sha256:doc.content_sha256,validator_version:batch.validator_version,normalizer_version:batch.normalizer_version,source_type:source,coverage:'validated_source_scope',location_coverage:[...new Set(batch.rows.map(row=>row.location).filter((value):value is string=>value!==null))],metrics:[...groups.values()]});
    }
   }
  }
  if(reason)result.blocked.push({source_type:source,reason});
 }
 return result;
}
