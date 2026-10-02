import type {ConfirmedMapping,RecognitionSummary} from '../../supabase/functions/_shared/cheshire-report-mapping.ts';
import { createContext, useContext } from 'react';
import type { FinanceSnapshot } from './finance';
import type { IntakeDocument, SourceType } from './intake';
export type IntakeContextValue={month:string;setMonth:(month:string)=>void;selected:SourceType;setSelected:(source:SourceType)=>void;documents:IntakeDocument[];referenceSnapshot:FinanceSnapshot|null;setReferenceSnapshot:(snapshot:FinanceSnapshot|null,ownerId:string|null)=>void;state:'checking'|'ready'|'unavailable'|'no-access';aiEnabled:boolean;mappingEnabled:boolean;suggestReportType:(summary:RecognitionSummary,hash:string)=>Promise<{source_types:SourceType[];ai_status:string}>;message:string;busy:boolean;refresh:()=>void;upload:(file:File,source:SourceType,replaces:string|null,mapping?:ConfirmedMapping)=>Promise<boolean>;review:(document:IntakeDocument)=>Promise<void>};
const noAction=()=>{};
export const IntakeContext=createContext<IntakeContextValue>({month:new Date().toISOString().slice(0,7),setMonth:noAction,selected:'coverage_manifest',setSelected:noAction,documents:[],referenceSnapshot:null,setReferenceSnapshot:noAction,state:'unavailable',aiEnabled:false,mappingEnabled:false,suggestReportType:async()=>({source_types:[],ai_status:'unavailable'}),message:'Monthly upload service is not connected.',busy:false,refresh:noAction,upload:async()=>false,review:async()=>{}});
export const useIntake=()=>useContext(IntakeContext);

