import {createLeadHandler} from "../server/leads/intake.mjs";
import {sheetsCall,sheetsConfigured} from "../server/crm/sheets.mjs";
const project="prj_M19hHqI7fq25KgKnXWIqUYRXmxhq";
const origins=new Set(["https://pincio-assessoria.vercel.app","https://oliveira-assessoria.vercel.app"]);
export default {async fetch(request){
 const env=process.env;
 const enabled=env.VERCEL_ENV==="production"&&env.VERCEL_PROJECT_ID===project&&env.PINCIO_LEADS_ENABLED==="1"&&sheetsConfigured(env);
 const store=enabled?{async save(payload){
  try{return await sheetsCall({actor:"public",action:"intake",data:payload});}
  catch(e){if(e.status===429)return {limited:true};throw e;}
 }}:null;
 return createLeadHandler({store,allowedOrigins:origins})(request);
}};
