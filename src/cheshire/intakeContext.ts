import { createContext, useContext } from 'react';
import type { FinanceSnapshot } from './finance';
import type { IntakeDocument, SourceType } from './intake';
export type IntakeContextValue={month:string;setMonth:(month:string)=>void;selected:SourceType;setSelected:(source:SourceType)=>void;documents:IntakeDocument[];referenceSnapshot:FinanceSnapshot|null;setReferenceSnapshot:(snapshot:FinanceSnapshot|null,ownerId:string|null)=>void;state:'checking'|'ready'|'unavailable'|'no-access';aiEnabled:boolean;message:string;busy:boolean;refresh:()=>void;upload:(file:File,source:SourceType,replaces:string|null)=>Promise<void>;review:(document:IntakeDocument)=>Promise<void>};
const noAction=()=>{};
export const IntakeContext=createContext<IntakeContextValue>({month:new Date().toISOString().slice(0,7),setMonth:noAction,selected:'coverage_manifest',setSelected:noAction,documents:[],referenceSnapshot:null,setReferenceSnapshot:noAction,state:'unavailable',aiEnabled:false,message:'Monthly upload service is not connected.',busy:false,refresh:noAction,upload:async()=>{},review:async()=>{}});
export const useIntake=()=>useContext(IntakeContext);
