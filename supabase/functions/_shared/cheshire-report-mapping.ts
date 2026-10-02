/** Local/header-only suggestions. Source bytes are reparsed and verified before review. */
import {INTAKE_REQUIREMENTS, INTAKE_LOCATIONS, SOURCE_TYPES, mapHeaders, parseDelimitedMatrix, tableFromMatrix, type SourceType, type ParsedTable} from './cheshire-intake.ts';
import {readXlsxSheet, validateFileSignature} from './cheshire-files.ts';
export const MAPPING_VERSION='cheshire-mapping-v1' as const;
export type ConfirmedMapping={version:typeof MAPPING_VERSION;source_sha256:string;source_type:SourceType;header_row:number;columns:string[];confirmed:true};
export type MappingProvenance=ConfirmedMapping&{confirmed_by:string;confirmed_at:string};
export type ReportCandidate={source_type:SourceType;header_row:number;headers:string[];columns:string[];matched_required:number;required_count:number;missing_fields:string[]};
export type HeaderOption={header_row:number;headers:string[]};
export type ReportInspection={header_options?:HeaderOption[];status:'supported'|'unsupported'|'restricted';reason:string;row_count:number;candidates:ReportCandidate[];warnings:string[]};
const ALL_FIELDS=new Set(INTAKE_REQUIREMENTS.flatMap(item=>[...item.fields,...(item.optionalFields??[])]));
const HASH=/^[a-f0-9]{64}$/;
function readSource(bytes:Uint8Array,filename:string,mime:string){const extension=validateFileSignature(bytes,filename,mime);if(extension==='xlsx')return readXlsxSheet(bytes);if(extension==='csv')return {matrix:parseDelimitedMatrix(new TextDecoder('utf-8',{fatal:true}).decode(bytes),true),formulas:false};return null;}
function privacyBlocked(matrix:(string|null)[][]){return matrix.some(row=>mapHeaders(row.map(value=>value??''),'coverage_manifest').blocked.length>0||row.some(value=>value&&/\b\d{3}-\d{2}-\d{4}\b/.test(value)));}
export function inspectReportUpload(bytes:Uint8Array,filename:string,mime:string):ReportInspection {
 try{
  const source=readSource(bytes,filename,mime);if(!source)return {status:'unsupported',reason:'PDF and image reports need manual review or an aggregate CSV/XLSX export. No OCR is performed.',row_count:0,candidates:[],warnings:[]};
  const {matrix,formulas}=source;if(matrix.some(row=>row.length>100))throw new Error('The report exceeds the 100-column review limit.');if(!matrix.length||matrix.length>10001)throw new Error('Provide a non-empty export with at most 10,000 detail rows.');
  if(privacyBlocked(matrix))return {status:'restricted',reason:'Restricted personal or patient-data markers were detected. Choose an aggregate-only corrected report.',row_count:0,candidates:[],warnings:[]};
  if(matrix.some(row=>row.filter(value=>INTAKE_LOCATIONS.includes(value as never)).length>=2))return {status:'unsupported',reason:'A location-matrix layout needs its existing overhead checks. Choose Location overhead; do not relabel it as a monthly actual.',row_count:matrix.length,candidates:[],warnings:[]};
  const candidates=INTAKE_REQUIREMENTS.map(requirement=>{
   let header=0,score=-1;for(let index=0;index<Math.min(matrix.length,40);index++){const mapped=mapHeaders(matrix[index].map(value=>value??''),requirement.id).mapped;const count=new Set(mapped.filter(field=>requirement.fields.includes(field))).size;if(count>score){header=index;score=count;}}
   const headers=matrix[header].map(value=>(value??'').trim());const columns=mapHeaders(headers,requirement.id).mapped;
   return {source_type:requirement.id,header_row:header+1,headers,columns,matched_required:score,required_count:requirement.fields.length,missing_fields:requirement.fields.filter(field=>!columns.includes(field))};
  }).sort((a,b)=>b.matched_required/b.required_count-a.matched_required/a.required_count||b.matched_required-a.matched_required);
  return {header_options:matrix.slice(0,40).map((row,index)=>({header_row:index+1,headers:row.map(value=>(value??'').trim())})),status:'supported',reason:'Suggested report types use recognized column labels. Confirm the meaning of each mapped field before upload.',row_count:Math.max(0,matrix.length-1),candidates,warnings:formulas?['Formula-derived values require manual review and cannot establish completion.']:[]};
 }catch(error){return {status:'unsupported',reason:error instanceof Error?error.message:'The report could not be inspected safely.',row_count:0,candidates:[],warnings:[]};}
}
export function candidateMapping(inspection:ReportInspection,sourceType:SourceType,hash:string,headerRow?:number):ConfirmedMapping|null {const candidate=inspection.candidates.find(item=>item.source_type===sourceType);if(!candidate)return null;const header=headerRow===undefined?null:inspection.header_options?.find(option=>option.header_row===headerRow);if(headerRow!==undefined&&!header)return null;return {version:MAPPING_VERSION,source_sha256:hash,source_type:sourceType,header_row:header?.header_row??candidate.header_row,columns:header?mapHeaders(header.headers,sourceType).mapped:[...candidate.columns],confirmed:true};}
export function validateMapping(value:unknown,hash:string,sourceType:SourceType):ConfirmedMapping {
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Confirm the column mapping before review.');const mapping=value as ConfirmedMapping;
 const keys=['version','source_sha256','source_type','header_row','columns','confirmed'];
 const fields=INTAKE_REQUIREMENTS.find(item=>item.id===sourceType);const allowed=[...(fields?.fields??[]),...(fields?.optionalFields??[])];
 if(Object.keys(mapping).some(key=>!keys.includes(key))||mapping.version!==MAPPING_VERSION||mapping.source_sha256!==hash||!HASH.test(hash)||mapping.source_type!==sourceType||mapping.confirmed!==true||!Number.isInteger(mapping.header_row)||mapping.header_row<1||mapping.header_row>40||!Array.isArray(mapping.columns)||mapping.columns.length<1||mapping.columns.length>100||mapping.columns.some(field=>typeof field!=='string'||field!==''&&!allowed.includes(field)))throw new Error('The confirmed mapping does not match this source version or report type.');
 const assigned=mapping.columns.filter(Boolean);if(new Set(assigned).size!==assigned.length)throw new Error('Each dashboard field can be mapped only once. Resolve duplicate mappings.');
 return {version:MAPPING_VERSION,source_sha256:hash,source_type:sourceType,header_row:mapping.header_row,columns:[...mapping.columns],confirmed:true};
}
export function mappingFromProvenance(value:unknown):unknown {if(!value||typeof value!=='object'||Array.isArray(value))return value;const {confirmed_by,confirmed_at,...mapping}=value as MappingProvenance;void confirmed_by;void confirmed_at;return mapping;}
export function parseMappedUpload(bytes:Uint8Array,filename:string,mime:string,sourceType:SourceType,hash:string,value:unknown):{table:ParsedTable;mapping:ConfirmedMapping} {
 const mapping=validateMapping(value,hash,sourceType);const source=readSource(bytes,filename,mime);if(!source)throw new Error('This file type does not support confirmed column mapping.');const {matrix,formulas}=source;
 if(privacyBlocked(matrix))return {mapping,table:{headers:[],rows:[],sourceRows:[],sourcePeriod:null,controlTotal:null,warnings:[],blockedFields:['restricted_source_markers']}};
 const header=matrix[mapping.header_row-1];if(!header||header.length!==mapping.columns.length)throw new Error('The mapping no longer matches the source columns. Inspect the original file again.');
 // Empty assignments remain unconsumed columns. They never silently disappear from validation.
 const renamed=mapping.columns.map((field,index)=>field||`unmapped_source_column_${index+1}`);
 const table=tableFromMatrix([renamed,...matrix.slice(mapping.header_row).map(row=>row.every(value=>value===null||value==='')?Array.from({length:renamed.length},()=>null):row)],sourceType);table.sourceRows=table.sourceRows.map(row=>row+mapping.header_row-1);
 if(matrix.slice(0,mapping.header_row-1).some(row=>row.some(value=>value!==null&&value!=='')))table.warnings.push('Nonempty content before the confirmed header requires manual review; no source rows have been discarded as verified data.');
 if(formulas)table.warnings.push('Formula-derived or cached workbook values need manual verification; formulas are never executed.');
 return {table,mapping};
}
export type RecognitionSummary={candidate_source_types:SourceType[];canonical_fields:string[];row_count:number};
/** Strict allowlist: never spread an inspection or send a header, filename, identifier or value. */
export function recognitionSummary(inspection:ReportInspection):RecognitionSummary {return {candidate_source_types:inspection.status==='supported'?inspection.candidates.filter(candidate=>candidate.matched_required>=2).map(candidate=>candidate.source_type):[],canonical_fields:[...new Set(inspection.candidates.flatMap(candidate=>candidate.columns).filter(field=>ALL_FIELDS.has(field)))].sort(),row_count:inspection.status==='supported'?Math.min(10000,inspection.row_count):0};}
export function validateRecognitionSummary(value:unknown):RecognitionSummary {
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Invalid recognition summary.');const summary=value as RecognitionSummary;
 if(Object.keys(summary).some(key=>!['candidate_source_types','canonical_fields','row_count'].includes(key))||!Array.isArray(summary.candidate_source_types)||summary.candidate_source_types.length>SOURCE_TYPES.length||summary.candidate_source_types.some(kind=>!SOURCE_TYPES.includes(kind))||!Array.isArray(summary.canonical_fields)||summary.canonical_fields.length>ALL_FIELDS.size||summary.canonical_fields.some(field=>!ALL_FIELDS.has(field))||!Number.isInteger(summary.row_count)||summary.row_count<0||summary.row_count>10000)throw new Error('Only approved canonical field codes, source types and bounded counts can be sent for recognition.');
 return {candidate_source_types:[...new Set(summary.candidate_source_types)],canonical_fields:[...new Set(summary.canonical_fields)].sort(),row_count:summary.row_count};
}
