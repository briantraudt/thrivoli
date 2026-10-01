import { handleIntake } from '../_shared/cheshire-intake-service.ts';
Deno.serve((request:Request)=>handleIntake(request,{
 SUPABASE_URL:Deno.env.get('SUPABASE_URL')??'',
 SUPABASE_SERVICE_ROLE_KEY:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')??'',
 HF_TOKEN:Deno.env.get('HF_TOKEN'),
}));
