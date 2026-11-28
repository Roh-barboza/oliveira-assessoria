import { writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { pathToFileURL } from "node:url";
// Legacy filename retained for existing workflows. Check the first-party endpoint
// using a read-only GET. No personal data is submitted and no external webhook used.
export async function checkLeadCors(fetcher=fetch,origin="https://pincio-assessoria.vercel.app") {
  const report={at:new Date().toISOString(),origin,method:"GET",leadSubmitted:false,receiptConfirmed:false};
  try {
    const response=await fetcher(origin+"/api/leads",{method:"GET",redirect:"error",credentials:"omit",signal:AbortSignal.timeout(12000)});
    report.httpStatus=response.status;
    report.status=response.status===405 && response.headers.get("allow")==="POST" && !response.headers.get("access-control-allow-origin") ? "passed":"failed";
  }catch(e){report.status="unreachable";report.errorType=e.name||"TransportError";}
  return report;
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  const report=await checkLeadCors();
  if(process.argv.includes("--output")){
    const output=process.argv[process.argv.indexOf("--output")+1];
    if(!output)throw Error("Caminho de saída necessário");
    await mkdir(dirname(output),{recursive:true});
    await writeFile(output,JSON.stringify(report,null,2)+"\n");
  }
  console.log("PINCIO_INTAKE_REPORT "+JSON.stringify(report));
}
