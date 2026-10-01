import { Inflate, strFromU8 } from 'fflate';
import { resolveXlsxIdentity, readXlsxStrings, readXlsxCells, createXlsxXmlBudget } from './cheshire-xlsx-identity.ts';
import { INTAKE_LOCATIONS, INTAKE_EXPENSE_CATEGORIES, mapHeaders, parseDelimited, tableFromMatrix, type ParsedTable, type SourceType } from './cheshire-intake.ts';
export const MAX_UPLOAD_BYTES=5*1024*1024;
const MAX_EXPANDED_BYTES=20*1024*1024;
export const UPLOAD_TYPES:Record<string,string>={csv:'text/csv',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',pdf:'application/pdf',png:'image/png'};
export function uploadExtension(filename:string){const extension=filename.toLowerCase().split('.').at(-1)??'';if(!(extension in UPLOAD_TYPES))throw new Error('Upload a CSV, XLSX, PDF or PNG file.');return extension;}
export function validateFileSignature(bytes:Uint8Array,filename:string,mime:string){
 const extension=uploadExtension(filename);if(!bytes.length||bytes.length>MAX_UPLOAD_BYTES)throw new Error('Files must be non-empty and no larger than 5 MB.');
 if(mime!==UPLOAD_TYPES[extension])throw new Error('The file extension and media type do not match.');
 const starts=(signature:number[])=>signature.every((value,index)=>bytes[index]===value);
 if(extension==='xlsx'&&!starts([0x50,0x4b,0x03,0x04]))throw new Error('This file is not a readable XLSX archive.');
 if(extension==='pdf'&&!starts([0x25,0x50,0x44,0x46,0x2d]))throw new Error('This file is not a PDF.');
 if(extension==='png'&&!starts([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]))throw new Error('This file is not a PNG image.');
 if(extension==='csv'&&(bytes.includes(0)||starts([0x50,0x4b])||starts([0x25,0x50,0x44,0x46])||starts([0x89,0x50,0x4e,0x47])))throw new Error('The CSV must be a UTF-8 text export.');
 return extension;
}
/** Bound ZIP entry count, advertised output allocation, ratio and paths before decompression. */
type ZipEntry={expanded:number;compressed:number;dataStart:number;dataEnd:number;localStart:number;localEnd:number;method:number;crc:number};
export function inspectXlsxArchive(bytes:Uint8Array){
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);let eocd=-1;
 for(let offset=bytes.length-22;offset>=Math.max(0,bytes.length-65557);offset--){if(view.getUint32(offset,true)===0x06054b50){eocd=offset;break;}}
 if(eocd<0)throw new Error('The XLSX archive directory is missing.');
 const count=view.getUint16(eocd+10,true),start=view.getUint32(eocd+16,true),directorySize=view.getUint32(eocd+12,true);
 if(count===0||count>250||start===0xffffffff||start+directorySize>eocd||view.getUint16(eocd+4,true)!==0||view.getUint16(eocd+6,true)!==0)throw new Error('The workbook archive exceeds supported limits.');
 const entries=new Map<string,ZipEntry>();let offset=start,total=0;
 for(let entry=0;entry<count;entry++){
  if(offset+46>eocd||view.getUint32(offset,true)!==0x02014b50)throw new Error('The workbook archive directory is invalid.');
  const flags=view.getUint16(offset+8,true),method=view.getUint16(offset+10,true),compressed=view.getUint32(offset+20,true),expanded=view.getUint32(offset+24,true),nameLength=view.getUint16(offset+28,true),extraLength=view.getUint16(offset+30,true),commentLength=view.getUint16(offset+32,true),local=view.getUint32(offset+42,true);
  if(offset+46+nameLength+extraLength+commentLength>eocd)throw new Error('The workbook archive entry is truncated.');
  const name=strFromU8(bytes.subarray(offset+46,offset+46+nameLength));
  if(flags&1||![0,8].includes(method)||expanded===0xffffffff||compressed===0xffffffff||expanded>5*1024*1024||expanded>Math.max(100*compressed,1024*1024))throw new Error('Compressed, encrypted or oversized workbook content requires manual review.');
  if(name.startsWith('/')||name.includes('..')||name.includes('\\')||entries.has(name)||/vbaProject|externalLinks|embeddings\//i.test(name))throw new Error('The workbook contains unsupported macros, links, embedded objects or paths.');
  if(local+30>start||view.getUint32(local,true)!==0x04034b50)throw new Error('The workbook local archive header is invalid.');
  const localNameLength=view.getUint16(local+26,true),localExtraLength=view.getUint16(local+28,true);if(local+30+localNameLength+localExtraLength+compressed>start)throw new Error('Workbook entry data exceeds its archive bounds.');
  const dataStart=local+30+localNameLength+localExtraLength,dataEnd=dataStart+compressed;let localEnd=dataEnd;
  if(view.getUint16(local+6,true)!==flags||view.getUint16(local+8,true)!==method||strFromU8(bytes.subarray(local+30,local+30+localNameLength))!==name)throw new Error('Workbook local and central headers disagree.');
  const crc=view.getUint32(offset+16,true);
  if(flags&8){const signed=dataEnd+4<=start&&view.getUint32(dataEnd,true)===0x08074b50;const descriptor=dataEnd+(signed?4:0);if(descriptor+12>start||view.getUint32(descriptor,true)!==crc||view.getUint32(descriptor+4,true)!==compressed||view.getUint32(descriptor+8,true)!==expanded)throw new Error('Workbook data descriptor disagrees with its directory.');localEnd=descriptor+12;}
  else if(view.getUint32(local+14,true)!==crc||view.getUint32(local+18,true)!==compressed||view.getUint32(local+22,true)!==expanded)throw new Error('Workbook local sizes disagree with the directory.');
  total+=expanded;if(total>MAX_EXPANDED_BYTES)throw new Error('The workbook expands beyond the 20 MB review limit.');
  entries.set(name,{expanded,compressed,dataStart,dataEnd,localStart:local,localEnd,method,crc});offset+=46+nameLength+extraLength+commentLength;
 }
 const ranges=[...entries.values()].sort((a,b)=>a.localStart-b.localStart);if(ranges.some((entry,index)=>index>0&&entry.localStart<ranges[index-1].localEnd))throw new Error('Workbook archive entries overlap.');
 if(offset!==start+directorySize||eocd+22+view.getUint16(eocd+20,true)!==bytes.length)throw new Error('Workbook archive boundaries are inconsistent.');
 if(!entries.has('[Content_Types].xml')||!entries.has('_rels/.rels'))throw new Error('The archive is not a supported XLSX workbook.');
 return entries;
}
function crc32(bytes:Uint8Array){let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return(crc^0xffffffff)>>>0;}
function expandEntry(bytes:Uint8Array,entry:ZipEntry){
 const chunks:Uint8Array[]=[];let total=0;
 const accept=(chunk:Uint8Array)=>{total+=chunk.length;if(total>entry.expanded||total>5*1024*1024)throw new Error('Expanded workbook content exceeds its declared or permitted size.');chunks.push(chunk.slice());};
 if(entry.method===0){if(entry.compressed!==entry.expanded)throw new Error('Stored workbook entry sizes disagree.');accept(bytes.subarray(entry.dataStart,entry.dataEnd));}
 else {const decoder=new Inflate((chunk)=>accept(chunk));const compressed=bytes.subarray(entry.dataStart,entry.dataEnd);if(!compressed.length)throw new Error('A compressed workbook entry is empty.');for(let offset=0;offset<compressed.length;offset+=1024){const end=Math.min(offset+1024,compressed.length);decoder.push(compressed.subarray(offset,end),end===compressed.length);}}
 if(total!==entry.expanded)throw new Error('Expanded workbook size does not match its directory.');const output=new Uint8Array(total);let offset=0;for(const chunk of chunks){output.set(chunk,offset);offset+=chunk.length;}if(crc32(output)!==entry.crc)throw new Error('Workbook content failed its integrity check.');return output;
}
function colIndex(value:string){let index=0;for(const char of value)index=index*26+char.charCodeAt(0)-64;return index-1;}
function sourceMonth(matrix:(string|null)[][]){for(const row of matrix.slice(0,12))for(let index=0;index<row.length;index++){if(/^(reporting|accounting)\s*month$/i.test(row[index]??'')&&/^\d{4}-(0[1-9]|1[0-2])$/.test(row[index+1]??''))return row[index+1];}return null;}
function sourceControl(matrix:(string|null)[][]){for(const row of matrix)for(let index=0;index<row.length;index++){if(/^(report|control|grand)\s*total$/i.test(row[index]??'')&&/^\d+(\.\d{1,2})?$/.test(row[index+1]??''))return row[index+1];}return null;}
function overheadMetadataKind(row:(string|null)[]):'month'|'control'|null {
 const filled=row.map((value,index)=>({value,index})).filter(cell=>cell.value!==null&&cell.value!=='');
 if(filled.length!==2||filled[1].index!==filled[0].index+1)return null;
 if(/^(reporting|accounting)\s*month$/i.test(filled[0].value??'')&&/^\d{4}-(0[1-9]|1[0-2])$/.test(filled[1].value??''))return 'month';
 if(/^(report|control|grand)\s*total$/i.test(filled[0].value??'')&&/^\d+(\.\d{1,2})?$/.test(filled[1].value??''))return 'control';
 return null;
}
export function parseXlsx(bytes:Uint8Array,sourceType:SourceType):ParsedTable {
 const entries=inspectXlsxArchive(bytes);const files:Record<string,Uint8Array>=Object.create(null);
 const read=(name:string)=>{const entry=entries.get(name);if(!entry)return '';files[name]??=expandEntry(bytes,entry);const value=strFromU8(files[name]);if(/<!DOCTYPE|<!ENTITY/i.test(value))throw new Error('Workbook XML entity declarations are unsupported.');return value;};
 const budget=createXlsxXmlBudget();const identity=resolveXlsxIdentity([...entries.keys()],read,budget);
 const shared=identity.sharedStrings?readXlsxStrings(read(identity.sharedStrings),budget):[];
 if(shared.length>200000||shared.some(value=>value.length>20000))throw new Error('Workbook strings exceed the review limit.');
 const candidates:ParsedTable[]=[];let totalCells=0;let populatedSheets=0;
 for(const name of identity.worksheets){
  const xml=read(name),matrix:(string|null)[][]=[];let formulas=false;let maxCol=0;
  for(const cell of readXlsxCells(xml,budget)){
   const coordinate=cell.coordinate.match(/^([A-Z]+)([1-9]\d*)$/)!;const row=Number(coordinate[2])-1,col=colIndex(coordinate[1]);
   if(row>=10001||col>=100||++totalCells>150000)throw new Error('Workbook rows or columns exceed the review limit.');
   const type=cell.type;if(cell.formula)formulas=true;let value=cell.value;
   if(type==='s'){if(value!==null){if(!/^\d+$/.test(value)||Number(value)>=shared.length)throw new Error('A workbook shared-string reference is invalid.');value=shared[Number(value)];}}
   else if(!['','n','str','inlineStr'].includes(type)&&value!==null)throw new Error('Boolean, error or unsupported typed workbook cells require manual review; they are not financial zeroes.');
   if(value&&value.length>20000)throw new Error('A workbook cell exceeds the review limit.');
   matrix[row]??=[];matrix[row][col]=value;maxCol=Math.max(maxCol,col+1);
  }
  if(!matrix.some(row=>row?.some(value=>value!==null&&value!==''))){if(formulas)throw new Error('A formula-bearing worksheet without cached values requires manual review; formulas are never executed.');continue;}
  if(++populatedSheets>1)throw new Error('Multiple populated worksheets require manual review. Upload one monthly aggregate sheet or CSV per document.');
  const rectangular=Array.from({length:matrix.length},(_,index)=>Array.from({length:maxCol},(_,col)=>matrix[index]?.[col]??null));
  const period=sourceMonth(rectangular),control=sourceControl(rectangular);
  const blocked=[...new Set(rectangular.flatMap(row=>mapHeaders(row.map(value=>value??''),sourceType).blocked))];
  if(rectangular.some(row=>row.some(value=>value&&/\b\d{3}-\d{2}-\d{4}\b/.test(value))))blocked.push('restricted_identifier_pattern');
  if(blocked.length)return{headers:[],rows:[],sourceRows:[],sourcePeriod:period,controlTotal:control,warnings:[],blockedFields:blocked};
  if(sourceType==='overhead'){
   const headerRow=rectangular.findIndex(row=>row.filter(value=>INTAKE_LOCATIONS.includes(value as typeof INTAKE_LOCATIONS[number])).length>=2);
   if(headerRow>=0){const columns=rectangular[headerRow].map((value,index)=>({value,index})).filter(item=>INTAKE_LOCATIONS.includes(item.value as typeof INTAKE_LOCATIONS[number]));const rows:Record<string,string|null>[]=[];const sourceRows:number[]=[];const matrixWarnings:string[]=[];const metadataCounts={month:0,control:0};const inspectMetadata=(row:(string|null)[],index:number)=>{if(!row.some(value=>value!==null&&value!==''))return;const kind=overheadMetadataKind(row);if(kind)metadataCounts[kind]++;else matrixWarnings.push(`Unconsumed content in overhead metadata row ${index+1} requires manual review.`);};rectangular.slice(0,headerRow).forEach(inspectMetadata);const otherHeaderCells=rectangular[headerRow].filter((value,index)=>value!==null&&value!==''&&!columns.some(column=>column.index===index));if(otherHeaderCells.length>1||otherHeaderCells.some(value=>mapHeaders([value??''],'overhead').mapped[0]!=='expense_category'))matrixWarnings.push('Unrecognized content in the overhead location header requires manual review.');
    for(let row=headerRow+1;row<rectangular.length;row++){const category=rectangular[row].find(value=>INTAKE_EXPENSE_CATEGORIES.includes(value as typeof INTAKE_EXPENSE_CATEGORIES[number]));if(!category){inspectMetadata(rectangular[row],row);continue;}const categoryCol=rectangular[row].indexOf(category);if(rectangular[row].some((value,index)=>value!==null&&value!==''&&index!==categoryCol&&!columns.some(column=>column.index===index)))matrixWarnings.push(`Unmapped nonempty cells on workbook row ${row+1} require review.`);for(const column of columns){rows.push({reporting_month:period,location:column.value,expense_category:category,amount:rectangular[row][column.index],report_total:control});sourceRows.push(row+1);}}
    if(metadataCounts.month>1||metadataCounts.control>1)matrixWarnings.push('Repeated overhead month or control-total rows require manual reconciliation.');
    candidates.push({headers:['reporting_month','location','expense_category','amount','report_total'],rows,sourceRows,sourcePeriod:period,controlTotal:control,warnings:[...matrixWarnings,...(formulas?['Formula-derived or cached workbook values need manual verification; formulas are never executed.']:[])],blockedFields:[]});continue;
   }
  }
  let header=-1,score=0;for(let index=0;index<Math.min(rectangular.length,40);index++){const fields=mapHeaders(rectangular[index].map(value=>value??''),sourceType).mapped.filter(Boolean).length;if(fields>score){score=fields;header=index;}}
  if(header>=0&&score>=2){const table=tableFromMatrix(rectangular.slice(header),sourceType);if(rectangular.slice(0,header).some(row=>row.some(Boolean)))table.warnings.push('Nonempty content before the header requires manual review; no unconsumed content is silently discarded.');table.sourceRows=table.sourceRows.map(row=>row+header);if(formulas)table.warnings.push('Formula-derived or cached workbook values need manual verification; formulas are never executed.');candidates.push(table);}
 }
 if(populatedSheets!==1)throw new Error('Multiple populated worksheets require manual review. Upload one monthly aggregate sheet or CSV per document.');
 if(candidates.length!==1)throw new Error(candidates.length?'The workbook contains multiple candidate tables. Upload one monthly aggregate table per document.':'No supported monthly aggregate table was found. Use the column template or provide a CSV export.');
 return candidates[0];
}
export function parseUpload(bytes:Uint8Array,filename:string,mime:string,sourceType:SourceType){const extension=validateFileSignature(bytes,filename,mime);if(extension==='csv')return parseDelimited(new TextDecoder('utf-8',{fatal:true}).decode(bytes),sourceType);if(extension==='xlsx')return parseXlsx(bytes,sourceType);return null;}
