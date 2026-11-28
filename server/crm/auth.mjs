import {createHmac,randomBytes,timingSafeEqual} from "node:crypto";
const encode=x=>Buffer.from(JSON.stringify(x)).toString("base64url");
const mac=(s,k)=>createHmac("sha256",k).update(s).digest("base64url");
export function seal(value,key){const p=encode(value);return p+"."+mac(p,key);}
export function unseal(token,key,now=Date.now()){
 if(typeof token!=="string"||token.length>4096||typeof key!=="string"||key.length<32)return null;
 try{const [p,s,...rest]=token.split(".");if(rest.length||!p||!s)return null;const a=Buffer.from(s),b=Buffer.from(mac(p,key));if(a.length!==b.length||!timingSafeEqual(a,b))return null;const v=JSON.parse(Buffer.from(p,"base64url"));return Number.isFinite(v.exp)&&v.exp>now?v:null;}catch{return null;}
}
export const nonce=()=>randomBytes(32).toString("base64url");
export function cookie(req,name){return (req.headers.get("cookie")||"").split(";").map(s=>s.trim()).find(s=>s.startsWith(name+"="))?.slice(name.length+1)||"";}
export function makeCookie(name,value,age){return name+"="+value+"; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age="+age;}
export function permitted(email,env){return typeof email==="string"&&(env.PINCIO_CRM_ALLOWED_EMAILS||"").split(",").map(x=>x.trim().toLowerCase()).filter(Boolean).includes(email.toLowerCase());}
