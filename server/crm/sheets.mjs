import {createHmac,randomUUID} from "node:crypto";
export function sheetsConfigured(env=process.env){
 try{const u=new URL(env.PINCIO_CRM_SCRIPT_URL);return u.origin==="https://script.google.com"&&/^\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(u.pathname)&&!u.search&&!u.hash&&typeof env.PINCIO_CRM_SHARED_SECRET==="string"&&env.PINCIO_CRM_SHARED_SECRET.length>=32;}catch{return false;}
}
export async function sheetsCall({actor,action,data={},id=randomUUID()},env=process.env,fetcher=fetch){
 if(!sheetsConfigured(env))throw Object.assign(Error("Integração Sheets indisponível."),{status:503});
 const payload=JSON.stringify({actor,action,data,id}),ts=Date.now(),sig=createHmac("sha256",env.PINCIO_CRM_SHARED_SECRET).update(ts+"."+payload).digest("base64url");
 const response=await fetcher(env.PINCIO_CRM_SCRIPT_URL,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({ts,payload,sig}),redirect:"follow",signal:AbortSignal.timeout(11000),cache:"no-store"});
 if(!response.ok)throw Object.assign(Error("Integração indisponível."),{status:503});
 const result=await response.json();
 if(result.ok!==true){const status=[400,403,404,409,422,429,503].includes(result.status)?result.status:503;throw Object.assign(Error("Não foi possível concluir a operação."),{status});}
 return result.data;
}
