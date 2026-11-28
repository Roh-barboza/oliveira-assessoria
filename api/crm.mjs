import {createHash,randomUUID} from "node:crypto";
import {seal,unseal,nonce,cookie,makeCookie,permitted} from "../server/crm/auth.mjs";
import {sheetsCall,sheetsConfigured} from "../server/crm/sheets.mjs";
const headers={"Cache-Control":"no-store, private","X-Robots-Tag":"noindex, nofollow","X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer"};
const reply=(b,status=200)=>Response.json(b,{status,headers});
const redir=(location,cookies=[])=>{const h=new Headers({...headers,Location:location});cookies.forEach(c=>h.append("Set-Cookie",c));return new Response(null,{status:303,headers:h});};
const SESSION="__Host-pincio-crm",STATE="__Host-pincio-oauth";
const ACTIONS=new Set(["dashboard","createLead","contact","sale","advance"]);
export default {async fetch(req){
 const env=process.env,url=new URL(req.url),op=url.searchParams.get("op")||"dashboard",origin=env.PINCIO_CRM_ORIGIN,key=env.PINCIO_CRM_SESSION_SECRET;
 if(env.VERCEL_PROJECT_ID!=="prj_M19hHqI7fq25KgKnXWIqUYRXmxhq"||env.PINCIO_CRM_ENABLED!=="1"||url.origin!==origin||!origin?.startsWith("https://")||!key||key.length<32||!env.PINCIO_GOOGLE_CLIENT_ID||!env.PINCIO_GOOGLE_CLIENT_SECRET||!sheetsConfigured(env))return reply({ok:false,error:"CRM aguardando configuração."},503);
 const redirectUri=origin+"/api/crm?op=callback";
 try{
  if(op==="login"&&req.method==="GET"){
   const state=nonce(),verifier=nonce(),challenge=createHash("sha256").update(verifier).digest("base64url");
   const query=new URLSearchParams({client_id:env.PINCIO_GOOGLE_CLIENT_ID,redirect_uri:redirectUri,response_type:"code",scope:"openid email",state,code_challenge:challenge,code_challenge_method:"S256",prompt:"select_account"});
   return redir("https://accounts.google.com/o/oauth2/v2/auth?"+query,[makeCookie(STATE,seal({state,verifier,exp:Date.now()+600000},key),600)]);
  }
  if(op==="callback"&&req.method==="GET"){
   const s=unseal(cookie(req,STATE),key);if(!s||s.state!==url.searchParams.get("state")||!url.searchParams.get("code"))return redir("/crm.html?erro=login",[makeCookie(STATE,"",0)]);
   const token=await fetch("https://oauth2.googleapis.com/token",{method:"POST",body:new URLSearchParams({code:url.searchParams.get("code"),client_id:env.PINCIO_GOOGLE_CLIENT_ID,client_secret:env.PINCIO_GOOGLE_CLIENT_SECRET,redirect_uri:redirectUri,grant_type:"authorization_code",code_verifier:s.verifier}),signal:AbortSignal.timeout(8000)});
   if(!token.ok)throw Error("OAuth failed");
   const {access_token}=await token.json();if(!access_token)throw Error("OAuth failed");
   const user=await fetch("https://openidconnect.googleapis.com/v1/userinfo",{headers:{Authorization:"Bearer "+access_token},signal:AbortSignal.timeout(8000)});
   if(!user.ok)throw Error("OAuth failed");
   const profile=await user.json();
   if(profile.email_verified!==true||!permitted(profile.email,env))return redir("/crm.html?erro=acesso",[makeCookie(STATE,"",0),makeCookie(SESSION,"",0)]);
   const email=profile.email.toLowerCase();
   // Sheet membership is checked before issuing a session and on every operation.
   await sheetsCall({actor:email,action:"dashboard"});
   return redir("/crm.html",[makeCookie(STATE,"",0),makeCookie(SESSION,seal({email,exp:Date.now()+28800000},key),28800)]);
  }
  const session=unseal(cookie(req,SESSION),key);
  if(!session||!permitted(session.email,env))return reply({ok:false,error:"Faça login."},401);
  if(req.method==="POST"&&(req.headers.get("origin")!==origin||req.headers.get("sec-fetch-site")==="cross-site"))return reply({ok:false,error:"Origem inválida."},403);
  if(op==="logout"&&req.method==="POST")return redir("/crm.html",[makeCookie(SESSION,"",0)]);
  if(!ACTIONS.has(op)||(op==="dashboard"?req.method!=="GET":req.method!=="POST"))return reply({ok:false,error:"Operação inválida."},405);
  let data={},id=randomUUID();
  if(req.method==="POST"){
   if(req.headers.get("content-type")?.split(";")[0]!=="application/json")return reply({ok:false,error:"Formato inválido."},415);
   const parts=[];let bytes=0;for await(const chunk of req.body||[]){bytes+=chunk.length;if(bytes>8192)return reply({ok:false,error:"Solicitação grande demais."},413);parts.push(Buffer.from(chunk));}
   try{const b=JSON.parse(Buffer.concat(parts).toString());if(!b||typeof b.data!=="object"||!b.data||Array.isArray(b.data)||!/^[a-f0-9-]{36}$/i.test(b.id))return reply({ok:false,error:"Dados inválidos."},422);data=b.data;id=b.id;}catch{return reply({ok:false,error:"JSON inválido."},400);}
  }
  return reply({ok:true,data:await sheetsCall({actor:session.email,action:op,data,id})});
 }catch(e){return reply({ok:false,error:"Não foi possível concluir a operação."},[403,404,409,422,429,503].includes(e.status)?e.status:503);}
}};
