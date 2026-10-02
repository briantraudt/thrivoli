import {validateMapping,mappingFromProvenance} from '../../supabase/functions/_shared/cheshire-report-mapping.ts';
import { INTAKE_REQUIREMENTS, REQUIRED_CHECKS, SOURCE_TYPES, hasCompletionEvidence, isMonth, type IntakeDocument, type SourceType, type ReviewResult } from '../../supabase/functions/_shared/cheshire-intake.ts';
import { financeSummary, type FinanceSnapshot } from './finance.ts';
export { INTAKE_REQUIREMENTS, SOURCE_TYPES, isMonth };
export type { IntakeDocument, SourceType, ReviewResult };
export type ChecklistState='missing'|'uploading'|'received'|'reviewing'|'incomplete'|'complete';
export type ChecklistItem={id:SourceType;title:string;status:ChecklistState;documents:IntakeDocument[];missing:string[];coveredLocations:string[];requiresUpload:boolean;carriedForward:boolean;summary:string};
const REVIEW_REVISION=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const STATES=new Set(['uploading','received','reviewing','incomplete','complete','error','quarantined']);
function month(value:unknown){if(value===null)return null;if(typeof value==='string'&&isMonth(value.slice(0,7)))return value.slice(0,7);throw new Error('Invalid intake reporting month');}
export function parseIntakeDocuments(input:unknown):IntakeDocument[]{
 if(!Array.isArray(input)||input.length>300)throw new Error('Invalid intake document list');
 return input.map(value=>{if(!value||typeof value!=='object')throw new Error('Invalid document');const row=value as Record<string,unknown>;
  if(typeof row.id!=='string'||!SOURCE_TYPES.includes(row.source_type as SourceType)||typeof row.file_name!=='string'||row.file_name.length>160||typeof row.content_sha256!=='string'||!/^[a-f0-9]{64}$/.test(row.content_sha256)||!STATES.has(String(row.status))||typeof row.created_at!=='string'||!Number.isFinite(Date.parse(row.created_at)))throw new Error('Invalid intake metadata');
  if(row.review_revision!=null&&(typeof row.review_revision!=='string'||!REVIEW_REVISION.test(row.review_revision)))throw new Error('Invalid review revision');
  if(row.validation_dependency_revisions!=null&&(typeof row.validation_dependency_revisions!=='object'||Array.isArray(row.validation_dependency_revisions)||Object.entries(row.validation_dependency_revisions).some(([kind,revision])=>!['coverage_manifest','payroll'].includes(kind)||typeof revision!=='string'||!REVIEW_REVISION.test(revision))))throw new Error('Invalid supporting review revisions');
  let review:ReviewResult|null=null;if(row.validation!==null&&row.validation!==undefined){const candidate=row.validation as ReviewResult;if((!['cheshire-intake-v1','source-audit-v1'].includes(candidate.validator_version)||candidate.validator_version==='source-audit-v1'&&row.status==='complete')||!Array.isArray(candidate.checks)||!Array.isArray(candidate.missing_items)||!Array.isArray(candidate.covered_locations)||!Array.isArray(candidate.canonical_fields)||candidate.checks.some(check=>!REQUIRED_CHECKS.includes(check.key)||typeof check.passed!=='boolean'||typeof check.message!=='string')||candidate.missing_items.some(item=>typeof item!=='string'))throw new Error('Invalid completion evidence');if(candidate.related_requests!==undefined&&(candidate.validator_version!=='source-audit-v1'||row.source_origin!=='existing_source'||!Array.isArray(candidate.related_requests)||candidate.related_requests.length>12||candidate.related_requests.some(request=>!request||!SOURCE_TYPES.includes(request.target_source_type)||[request.title,request.period_label,request.scope_label,request.unlocks].some(value=>typeof value!=='string'||value.length>1000)||!Array.isArray(request.missing_items)||request.missing_items.length>12||request.missing_items.some(value=>typeof value!=='string'||value.length>1000))))throw new Error('Invalid related source requests');if(candidate.missing_amounts!==undefined&&(!Array.isArray(candidate.missing_amounts)||candidate.missing_amounts.length>140||candidate.missing_amounts.some(cell=>!cell||typeof cell.location!=='string'||typeof cell.category!=='string'||cell.source_cell!==undefined&&typeof cell.source_cell!=='string')))throw new Error('Invalid missing amount details');if(candidate.reported_metrics!==undefined&&(candidate.validator_version!=='source-audit-v1'||row.source_origin!=='existing_source'||!Array.isArray(candidate.reported_metrics)||candidate.reported_metrics.length>12||candidate.reported_metrics.some(metric=>!metric||typeof metric.label!=='string'||metric.label.length>120||typeof metric.value!=='number'||!Number.isFinite(metric.value)||metric.value<0||!['count','USD','hours','units'].includes(metric.unit)||metric.note!==undefined&&(typeof metric.note!=='string'||metric.note.length>500))))throw new Error('Invalid reported source metrics');if(candidate.mapping){validateMapping(mappingFromProvenance(candidate.mapping),row.content_sha256,row.source_type as SourceType);if(typeof candidate.mapping.confirmed_by!=='string'||!REVIEW_REVISION.test(candidate.mapping.confirmed_by)||typeof candidate.mapping.confirmed_at!=='string'||!Number.isFinite(Date.parse(candidate.mapping.confirmed_at)))throw new Error('Invalid mapping provenance');}review=candidate;}
  return {...row,requested_month:month(row.requested_month),reported_month:month(row.reported_month),validation:review} as unknown as IntakeDocument;
 });
}
export function activeDocuments(documents:IntakeDocument[]){const superseded=new Set(documents.map(doc=>doc.supersedes_id).filter(Boolean));return documents.filter(doc=>!superseded.has(doc.id)).sort((a,b)=>b.created_at.localeCompare(a.created_at)||b.id.localeCompare(a.id));}
function dependentKinds(kind:SourceType):SourceType[]{if(['insurance_revenue','clinic_activity','school_billing','cash_programs','payroll','operating_expenses'].includes(kind))return['coverage_manifest'];if(kind==='staff_allocation')return['coverage_manifest','payroll'];return[];}
export function buildMonthlyChecklist(documents:IntakeDocument[],selectedMonth:string,snapshot:FinanceSnapshot|null):ChecklistItem[]{
 const current=documents.filter(doc=>doc.requested_month===selectedMonth);const active=activeDocuments(current);
 // A same-byte re-review changes its server-owned revision. ID/hash alone cannot prove freshness.
 // Resolve supporting reviews recursively so a stale payroll cannot validate staff allocation.
 const currentDependency=(kind:SourceType,visiting:Set<SourceType>):IntakeDocument|null=>{
  if(visiting.has(kind))return null;const matching=active.filter(doc=>doc.source_type===kind);
  if(matching.length!==1||!hasCompletionEvidence(matching[0],selectedMonth)||!matching[0].review_revision)return null;
  const document=matching[0];const next=new Set(visiting).add(kind);
  return dependentKinds(kind).every(dependency=>matchesDependency(document,dependency,next))?document:null;
 };
 const matchesDependency=(document:IntakeDocument,kind:SourceType,visiting=new Set<SourceType>()):boolean=>{
  const expected=currentDependency(kind,visiting);
  return Boolean(expected&&document.validation_dependencies?.[kind]===`${expected.id}:${expected.content_sha256}`&&document.validation_dependency_revisions?.[kind]===expected.review_revision);
 };
 return INTAKE_REQUIREMENTS.map(requirement=>{
  const matching=active.filter(doc=>doc.source_type===requirement.id);const reference=snapshot&&requirement.id==='overhead'&&(matching.length===0||matching.every(document=>document.validation?.reference_basis==='fixed_monthly_baseline'&&document.validation_dependencies?.overhead_reference===snapshot.revisionId))?snapshot:null;
  if(reference){const summary=financeSummary(reference);const fixed=reference.costBasis==='fixed_monthly_baseline';const issues=[...(summary.missingCellCount?[`${summary.missingCellCount} source cells are blank. Confirm their amounts or whether they are not applicable; blanks have not been turned into zero.`]:[]),...(!fixed&&!reference.effectiveMonth?['The source accounting month has not been confirmed.']:[]),'Expense overlap and the complete cost scope must be reconciled before profit can be reported.'];return{id:requirement.id,title:fixed?'Fixed overhead reference':requirement.shortTitle,status:'incomplete',documents:matching,missing:issues,coveredLocations:Object.keys(summary.byLocation),requiresUpload:!fixed,carriedForward:fixed,summary:fixed?'Carried forward. Upload only when these fixed costs change.':'Existing source received; reporting details remain unresolved.'};}
  const covered=[...new Set(matching.flatMap(doc=>doc.reported_month===selectedMonth?doc.validation?.covered_locations??[]:[]))];
  if(!matching.length)return{id:requirement.id,title:requirement.shortTitle,status:'missing',documents:[],missing:['No current-month source has been received for this document group.'],coveredLocations:[],requiresUpload:true,carriedForward:false,summary:'Current-period source needed'};
  const latest=matching[0];const missing=[...(latest.validation?.missing_items??[])];
  const baselineStale=requirement.id==='operating_expenses'&&(!snapshot?.revisionId||latest.validation_dependencies?.overhead_reference!==snapshot.revisionId);
  const dependencyStale=baselineStale||dependentKinds(requirement.id).some(kind=>!matchesDependency(latest,kind));
  if(dependencyStale)missing.push('A required monthly supporting source is missing, changed or not verified. Re-run this review after the supporting source is complete.');
  if(matching.length>1)missing.push('Multiple files are retained. Their combined scope and overlapping rows still need cross-file reconciliation; individual uploads do not make the monthly group complete.');
  const reviewVersionMissing=!latest.review_revision;
  if(reviewVersionMissing&&hasCompletionEvidence(latest,selectedMonth))missing.push('Re-run this review to verify its current source version.');
  const verified=matching.length===1&&!reviewVersionMissing&&!dependencyStale&&hasCompletionEvidence(latest,selectedMonth);
  const status:ChecklistState=verified?'complete':latest.status==='uploading'?'uploading':latest.status==='reviewing'?'reviewing':latest.status==='received'?'received':'incomplete';
  if(!missing.length&&!verified)missing.push(latest.failure_message||'The uploaded source is awaiting a verified review result.');
  return{id:requirement.id,title:requirement.shortTitle,status,documents:matching,missing,coveredLocations:covered,requiresUpload:true,carriedForward:false,summary:verified?'Required document checks passed':`${matching.length} ${matching.length===1?'file':'files'} retained${covered.length?` · ${covered.length} locations with source evidence`:''}`};
 });
}

