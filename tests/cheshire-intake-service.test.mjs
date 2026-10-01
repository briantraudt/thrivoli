// Mocked request tests only. No external calls, real credentials, source data or repository writes.
import assert from 'node:assert/strict';
import { handleIntake,sha256 } from '../supabase/functions/_shared/cheshire-intake-service.ts';
import { INTAKE_LOCATIONS } from '../supabase/functions/_shared/cheshire-intake.ts';
const USER='11111111-1111-1111-1111-111111111111';
const DOC='22222222-2222-2222-2222-222222222222';
const privateMarker='SYNTHETIC_PRIVATE_NEVER_TRANSMIT';
const csv='reporting_month,location,program,income,report_total\n'+INTAKE_LOCATIONS.map(l=>`2026-09,${l},${privateMarker},0,0`).join('\n');
const bytes=new TextEncoder().encode(csv),hash=await sha256(bytes);
const env={SUPABASE_URL:'https://synthetic.invalid',SUPABASE_SERVICE_ROLE_KEY:'mock-service-secret'};
const initial=()=>({id:DOC,source_type:'cash_programs',requested_month:'2026-09-01',reported_month:null,uploaded_by:USER,file_name:privateMarker+'.csv',content_sha256:hash,byte_size:bytes.length,mime_type:'text/csv',storage_path:`${USER}/${DOC}/source.csv`,source_origin:'portal_upload',status:'uploading',validation:null,validation_scope:null,validation_dependencies:{},review_started_at:null});
const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
function mock(options={}) {
 const calls=[];let row={...initial(),...(options.existing??{})};const state={calls,get row(){return row;}};
 state.fetch=async(input,init={})=>{
  const u=new URL(typeof input==='string'?input:input.url);const method=init.method??'GET';let payload=init.body?JSON.parse(init.body):null;calls.push({url:u.toString(),method,payload});
  if(u.pathname==='/auth/v1/user')return options.badAuth?reply({},401):reply({id:USER,email:'synthetic@example.test',email_confirmed_at:'2026-01-01'});
  if(u.pathname==='/rest/v1/cheshire_intake_settings')return options.aiSettingsUnavailable?reply({},503):reply([{ai_enabled:options.enableAi===true,ai_monthly_limit:5}]);
  if(u.pathname==='/rest/v1/cheshire_finance_reader')return reply(options.noReader?[]:[{user_id:USER}]);
  if(u.pathname==='/rest/v1/cheshire_portal_member')return reply(options.noPortal?[]:[{email:'synthetic@example.test'}]);
  if(u.pathname==='/rest/v1/cheshire_intake_document'){
   if(method==='GET'){
    if(u.searchParams.get('source_type')?.startsWith('in.'))return reply([]);
    return reply([row]);
   }
   if(method==='PATCH'){
    const tokenFilter=u.searchParams.get('review_token');
    if(options.staleSave&&tokenFilter&&payload?.status!=='error')return reply([]);
    if(tokenFilter&&tokenFilter!=='eq.'+row.review_token)return reply([]);
    const status=u.searchParams.get('status');if(status&&status!=='eq.'+row.status)return reply([]);
    row={...row,...payload};return reply([row]);
   }
   throw Error('Unexpected document operation '+method);
  }
  if(u.pathname.startsWith('/storage/v1/object/'))return options.storageMissing?reply({},404):new Response(options.hashMismatch?new Uint8Array([1,2,3]):bytes);
  if(u.pathname==='/rest/v1/rpc/reserve_cheshire_intake_ai_call')return options.aiReservationUnavailable?reply({},503):reply(options.aiAlreadyReserved?false:true);
  if(u.hostname==='router.huggingface.co')return reply({choices:[{message:{content:options.aiMalicious?'{"status":"complete","check_codes":[],"source_types":[]}':'{"check_codes":[],"source_types":[]}'}}]});
  throw Error('Unexpected mock route '+u);
 };
 return state;
}
async function run(name,options,body,extraEnv={},headers={Authorization:'Bearer mock-token'}) {
 const state=mock(options);const response=await handleIntake(new Request('https://edge.invalid',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify(body)}),{...env,...extraEnv},state.fetch);const data=await response.json();console.log(JSON.stringify({name,status:response.status,resultStatus:data.document?.status,code:data.code,aiStatus:data.document?.validation?.ai_status,calls:state.calls.length}));return {response,data,state};
}
const review={operation:'review',document_id:DOC,expected_sha256:hash};
let r=await run('no_token',{},review,{},{});assert.equal(r.response.status,401);assert.equal(r.state.calls.length,0);
r=await run('invalid_auth',{badAuth:true},review);assert.equal(r.response.status,401);assert.equal(r.state.calls.length,1);
for(const flag of ['noReader','noPortal']){r=await run(flag,{[flag]:true},review);assert.equal(r.response.status,403);assert.equal(r.state.calls.length,3);}
r=await run('client_status_rejected',{}, {...review,status:'complete'});assert.equal(r.response.status,400);
r=await run('missing_storage',{storageMissing:true},review);assert.equal(r.response.status,409);assert.equal(r.state.row.status,'uploading');
r=await run('hash_mismatch',{hashMismatch:true},review);assert.equal(r.response.status,422);assert.equal(r.state.row.status,'uploading');
r=await run('stale_save_denied',{staleSave:true},review);assert.equal(r.response.status,409);assert.notEqual(r.state.row.status,'complete');
r=await run('ai_disabled_without_cap',{},review,{HF_TOKEN:'mock-hf-token',CHESHIRE_INTAKE_AI_ENABLED:'true'});assert(!r.state.calls.some(c=>c.url.includes('huggingface')));
r=await run('ai_payload_sanitized',{enableAi:true},review,{HF_TOKEN:'mock-hf-token',CHESHIRE_INTAKE_AI_ENABLED:'true',CHESHIRE_INTAKE_AI_MONTHLY_LIMIT:'5'});const ai=r.state.calls.find(c=>c.url.includes('huggingface'));assert(ai);assert(!JSON.stringify(ai.payload).includes(privateMarker));assert(!JSON.stringify(ai.payload).includes(USER));assert(!JSON.stringify(ai.payload).includes(hash));
r=await run('ai_rejects_extra_authority',{aiMalicious:true,enableAi:true},review,{HF_TOKEN:'mock-hf-token',CHESHIRE_INTAKE_AI_ENABLED:'true',CHESHIRE_INTAKE_AI_MONTHLY_LIMIT:'5'});assert.equal(r.data.document.validation.ai_status,'unavailable');
r=await run('ai_reserved_prevents_recall',{aiAlreadyReserved:true,enableAi:true},review,{HF_TOKEN:'mock-hf-token',CHESHIRE_INTAKE_AI_ENABLED:'true',CHESHIRE_INTAKE_AI_MONTHLY_LIMIT:'5'});assert(!r.state.calls.some(c=>c.url.includes('huggingface')));
console.log('All service probe assertions passed');

r=await run('ai_reservation_unavailable_preserves_deterministic',{aiReservationUnavailable:true,enableAi:true},review,{HF_TOKEN:'mock-hf-token',CHESHIRE_INTAKE_AI_ENABLED:'true',CHESHIRE_INTAKE_AI_MONTHLY_LIMIT:'5'});console.log(JSON.stringify({case:'ai_budget_rpc_outage',retainedValidation:!!r.state.row.validation,storedStatus:r.state.row.status}));assert.equal(r.response.status,200);assert(r.state.row.validation);assert.equal(r.state.row.validation.ai_status,'unavailable');

r=await run('ai_settings_outage_fails_closed',{aiSettingsUnavailable:true},review,{HF_TOKEN:'mock-hf-token'});assert.equal(r.response.status,200);assert(!r.state.calls.some(c=>c.url.includes('huggingface')));

const savedReview={...r.state.row.validation,ai_status:'assisted',ai_suggestions:{check_codes:['location_coverage'],source_types:['cash_programs']}};
r=await run('unchanged_review_reuses_saved_priority',{aiAlreadyReserved:true,enableAi:true,existing:{validation:savedReview,validation_dependencies:{}}},review,{HF_TOKEN:'mock-hf-token'});assert.equal(r.data.document.validation.ai_status,'assisted');assert.deepEqual(r.data.document.validation.ai_suggestions,savedReview.ai_suggestions);assert(!r.state.calls.some(c=>c.url.includes('huggingface')));
r=await run('changed_dependencies_discard_saved_priority',{aiAlreadyReserved:true,enableAi:true,existing:{validation:savedReview,validation_dependencies:{coverage_manifest:'old'}}},review,{HF_TOKEN:'mock-hf-token'});assert.equal(r.data.document.validation.ai_status,'unavailable');assert.equal(r.data.document.validation.ai_suggestions,undefined);
const streamState=mock();let sent=0,cancelled=false;const stream=new ReadableStream({pull(controller){if(sent++<17)controller.enqueue(new Uint8Array(1024).fill(32));else controller.close();},cancel(){cancelled=true;}});const oversized=new Request('https://synthetic.invalid/review',{method:'POST',headers:{Authorization:'Bearer synthetic-only'},body:stream,duplex:'half'});const oversizedResult=await handleIntake(oversized,env,streamState.fetch);assert.equal(oversizedResult.status,422);assert.equal(cancelled,true);assert(!streamState.calls.some(call=>call.method==='PATCH'||call.method==='POST'));console.log('Bounded streamed metadata rejects overflow without mutation');
