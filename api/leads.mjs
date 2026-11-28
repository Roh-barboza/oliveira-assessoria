import { createLeadHandler, postgresLeadStore } from "../server/leads/intake.mjs";
const project="prj_M19hHqI7fq25KgKnXWIqUYRXmxhq";
const origins=new Set(["https://pincio-assessoria.vercel.app","https://oliveira-assessoria.vercel.app"]);
let store;
export default {async fetch(request){
  const env=process.env;
  // Real intake is opt-in, separate from the synthetic and operational systems.
  if(!store && env.VERCEL_ENV==="production" && env.VERCEL_PROJECT_ID===project &&
     env.PINCIO_LEADS_ENABLED==="1" && env.PINCIO_LEADS_DATABASE_URL &&
     /^[a-f0-9]{64}$/i.test(env.PINCIO_LEADS_DATA_KEY||"") &&
     ![env.OLIVEIRA_OPS_DATABASE_URL,env.OLIVEIRA_PREVIEW_DATABASE_URL,env.DATABASE_URL].filter(Boolean).includes(env.PINCIO_LEADS_DATABASE_URL) &&
     ![env.OLIVEIRA_DATA_KEY,env.OLIVEIRA_OPS_DATA_KEY].filter(Boolean).includes(env.PINCIO_LEADS_DATA_KEY)) {
    try {
      const {Pool}=await import("pg");
      const pool=new Pool({connectionString:env.PINCIO_LEADS_DATABASE_URL,max:2,connectionTimeoutMillis:5000,idleTimeoutMillis:10000,statement_timeout:8000});
      store=postgresLeadStore(pool,env.PINCIO_LEADS_DATA_KEY);
    } catch { /* fail closed; no alternative recipient or logging of personal data */ }
  }
  return createLeadHandler({store,allowedOrigins:origins})(request);
}};
