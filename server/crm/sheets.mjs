import {createHmac,randomUUID} from "node:crypto";
export function sheetsConfigured(env=process.env){
 try{const u=new URL(env.PINCIO_CRM_SCRIPT_URL);return u.origin==="https://script.google.com"&&!u.username&&!u.password&&/^\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(u.pathname)&&!u.search&&!u.hash&&typeof env.PINCIO_CRM_SHARED_SECRET==="string"&&env.PINCIO_CRM_SHARED_SECRET.length>=32;}catch{return false;}
}
export async function sheetsCall({actor,action,data={},id=randomUUID()},env=process.env,fetcher=fetch){
 if(!sheetsConfigured(env))throw Object.assign(Error("Integração Sheets indisponível."),{status:503});
 const payload=JSON.stringify({actor,action,data,id}),ts=Date.now(),sig=createHmac("sha256",env.PINCIO_CRM_SHARED_SECRET).update(ts+"."+payload).digest("base64url");
 const unavailable=()=>Object.assign(Error("Integração indisponível."),{status:503});
 const options={redirect:"manual",signal:AbortSignal.timeout(11000),cache:"no-store"};
 let result;
 try{
  let response=await fetcher(env.PINCIO_CRM_SCRIPT_URL,{...options,method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({ts,payload,sig})});
  // ContentService returns its response through a one-time Google URL.
  if(response.status===302||response.status===303){
   const output=new URL(response.headers.get("location"));
   if(output.origin!=="https://script.googleusercontent.com"||output.username||output.password||output.pathname!=="/macros/echo")throw unavailable();
   response=await fetcher(output.href,options);
  }
  if(!response.ok)throw unavailable();
  result=await response.json();
 }catch{throw unavailable();}
 if(!result||typeof result!=="object")throw unavailable();
 if(result.ok!==true){const status=[400,403,404,409,422,429,503].includes(result.status)?result.status:503;throw Object.assign(Error("Não foi possível concluir a operação."),{status});}
 return result.data;
}
