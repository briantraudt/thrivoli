import assert from 'node:assert/strict';
// Synthetic archive probes only. No customer files or network.
import { INTAKE_REQUIREMENTS, INTAKE_LOCATIONS, validateTable } from '../supabase/functions/_shared/cheshire-intake.ts';
import { inspectXlsxArchive,parseXlsx } from '../supabase/functions/_shared/cheshire-files.ts';
import { zipSync,strToU8 } from 'fflate';
const fields=INTAKE_REQUIREMENTS.find(r=>r.id==='cash_programs').fields;
const base=[fields,...INTAKE_LOCATIONS.map(location=>['2026-09',location,'synthetic-program','0','0'])];
const cell=(v,c,r)=>`<c r="${String.fromCharCode(65+c)}${r+1}" t="inlineStr"><is><t>${v}</t></is></c>`;
const make=(transform=(x)=>x,extra={})=>zipSync({'[Content_Types].xml':strToU8('<Types/>'),'xl/workbook.xml':strToU8('<workbook/>'),'xl/worksheets/sheet1.xml':strToU8(`<worksheet><sheetData>${base.map((row,r)=>row.map((v,c)=>transform(cell(v,c,r),c,r)).join('')).join('')}</sheetData></worksheet>`),...extra});
const check=(name,fn)=>{try{const table=fn();const review=validateTable(table,'cash_programs','2026-09',{expectedProvidersBySource:{cash_programs:Object.fromEntries(INTAKE_LOCATIONS.map(l=>[l,['synthetic-program']]))}});assert.notEqual(review.status,'complete',name);console.log(JSON.stringify({name,accepted:review.status==='complete',status:review.status,firstIncome:table.rows[0]?.income,warnings:table.warnings}));}catch(e){if(e.code==='ERR_ASSERTION')throw e;console.log(JSON.stringify({name,accepted:false,rejected:e.message}));}};
check('missing_shared_string_value_becomes_zero',()=>parseXlsx(make((original,c,r)=>r&&c===3?`<c r="D${r+1}" t="s"/>`:original,{'xl/sharedStrings.xml':strToU8('<sst><si><t>0</t></si></sst>')}),'cash_programs'));
check('boolean_values_become_money',()=>parseXlsx(make((original,c,r)=>r&&c===3?`<c r="D${r+1}" t="b"><v>0</v></c>`:original),'cash_programs'));
check('vba_project',()=>parseXlsx(make(x=>x,{'xl/vbaProject.bin':new Uint8Array([1,2,3])}),'cash_programs'));
check('ole_embedding',()=>parseXlsx(make(x=>x,{'xl/embeddings/oleObject1.bin':new Uint8Array([1,2,3])}),'cash_programs'));
check('external_relationship',()=>parseXlsx(make(x=>x,{'xl/_rels/workbook.xml.rels':strToU8('<Relationships><Relationship TargetMode="External" Target="https://synthetic.invalid" /></Relationships>')}),'cash_programs'));
check('dishonest_expanded_size',()=>{const a=make(x=>x,{'xl/worksheets/sheet2.xml':strToU8('<worksheet>'+('a'.repeat(900_000))+'</worksheet>')});const entries=inspectXlsxArchive(a);const e=entries.get('xl/worksheets/sheet2.xml');const v=new DataView(a.buffer,a.byteOffset,a.byteLength);v.setUint32(e.localStart+22,1,true);for(let i=0;i+46<a.length;i++){if(v.getUint32(i,true)===0x02014b50&&v.getUint32(i+42,true)===e.localStart){v.setUint32(i+24,1,true);break;}}return parseXlsx(a,'cash_programs');});
check('wrong_crc',()=>{const a=make();const entries=inspectXlsxArchive(a);const e=entries.get('xl/worksheets/sheet1.xml');const v=new DataView(a.buffer,a.byteOffset,a.byteLength);v.setUint32(e.localStart+14,123,true);for(let i=0;i+46<a.length;i++){if(v.getUint32(i,true)===0x02014b50&&v.getUint32(i+42,true)===e.localStart){v.setUint32(i+16,123,true);break;}}return parseXlsx(a,'cash_programs');});
