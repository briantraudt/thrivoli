/** Fictional values and labels only. */
export function schoolAuditFixture({ leading = false } = {}) {
  const months = (leading ? [null] : []).concat([1,2,3,4,5,6,7,9,10,11,12]);
  const columns = leading ? [3,5,7,9,11,13,15,18,20,22,24,26] : [3,5,7,9,11,13,15,17,19,21,23];
  const letter = n => String.fromCharCode(64+n);
  const periods = months.map((m,i)=>({id:m===null?'unassigned-december':m===7?'07-08':String(m).padStart(2,'0'),label:m===null?'Unconfirmed December':m===7?'July / August':`Month ${m}`,start:m,end:m===7?8:m,hoursColumn:letter(columns[i]-1),incomeColumn:letter(columns[i])}));
  const cell=(ref,state,value)=>({ref,state,value,formula:null});
  const rows=[4,5].map(row=>({row,label:'Fictional Academy',values:periods.map(p=>({
    hours:cell(`${p.hoursColumn}${row}`,p.start===1?'number':'blank',p.start===1?'2':null),
    income:cell(`${p.incomeColumn}${row}`,p.start===1||p.start===7||p.start===null?'number':'blank',p.start===1?'10.25':p.start===7?'20.00':p.start===null?'5.00':null),
  }))}));
  return {version:'school-income-audit-v1',source:{sha256:'a'.repeat(64),filename:'Fictional school income.xlsx',byteSize:1000,libraryId:'libfile_fictional',libraryVersion:0},
    currency:null,accountingBasis:null,hoursBasis:null,mappings:null,
    sheets:[{sheet:'2026',year:2026,periods,rows,controls:[],notes:['Fictional source review note.'],numericCells:leading?6:4,populatedPairs:leading?6:4,rawHundredths:leading?'7050':'6050'}]};
}
export function schoolDocumentFixture() {
  return {id:'fictional-school-document',source_type:'school_billing',source_origin:'existing_source',status:'incomplete',
    requested_month:null,reported_month:null,storage_path:null,content_sha256:'a'.repeat(64),file_name:'Fictional school income.xlsx',created_at:'2026-09-01T00:00:00Z',
    validation:{validator_version:'source-audit-v1',status:'incomplete',reported_month:null,checks:[],missing_items:['Confirm fictional basis'],covered_locations:[],canonical_fields:[],ai_status:'not_requested',school_income_audit:schoolAuditFixture()}};
}
