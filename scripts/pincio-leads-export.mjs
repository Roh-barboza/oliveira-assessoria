import { Pool } from "pg";
import { encryption } from "../server/platform/security.mjs";
if(!process.argv.includes("--confirm-private-export")) throw Error("Exportação privada: confirme --confirm-private-export e proteja o destino.");
const url=process.env.PINCIO_LEADS_READONLY_DATABASE_URL;
if(!url) throw Error("Configure uma conexão de leitura dedicada.");
const cipher=encryption(process.env.PINCIO_LEADS_DATA_KEY);
const pool=new Pool({connectionString:url,max:1,connectionTimeoutMillis:5000,statement_timeout:10000});
try {
  const {rows}=await pool.query("SELECT id,created_at,status,payload FROM pincio_leads ORDER BY created_at DESC,id LIMIT 1000");
  const result=rows.map(row=>({id:row.id,created_at:row.created_at,status:row.status,...JSON.parse(cipher.open(row.payload,"pincio-lead:"+row.id).toString("utf8"))}));
  process.stdout.write(JSON.stringify(result,null,2)+"\n");
} finally {await pool.end();}
