// Deploy as owner; no direct browser access to data. Every request must be signed by the server.
const TABLES={
 LEADS:"id criado_em nome whatsapp servico origem status responsavel mensagem ultimo_contato proximo_followup tentativas atualizado_em",
 TAREFAS:"id lead_id processo_id tipo titulo vencimento responsavel status criado_em concluido_em",
 ATENDIMENTOS:"id lead_id processo_id data canal resultado observacao responsavel",
 CLIENTES:"id lead_id nome whatsapp criado_em responsavel",
 VENDAS:"id lead_id cliente_id servico valor_centavos data responsavel status",
 PROCESSOS:"id venda_id cliente_id servico etapa ordem status inicio atualizado_em responsavel",
 HISTORICO_SERVICOS:"id processo_id data etapa_anterior etapa_nova observacao responsavel",
 FLUXOS:"servico ordem etapa prazo_interno_dias",USUARIOS:"email perfil ativo",
 AUDITORIA:"id data usuario acao entidade_id",CONFIG:"chave valor descricao",OPERACOES:"id hash resultado criado_em"
};
const OPEN=["novo","em_atendimento","aguardando_retorno","proposta"];
const CHANNELS=["WhatsApp","E-mail","Telefone","Reunião","Outro"];
const RESULTS=["sem_resposta","respondeu","proposta","perdido"];
function fail_(status,message){throw Object.assign(new Error(message),{status});}
function text_(value,max,required){if(typeof value!=="string"||value.length>max||(required&&!value.trim())||/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value))fail_(422,"Campo inválido.");return value.trim();}
function iso_(now,days){return new Date(Date.parse(now)+days*86400000).toISOString();}
function id_(value){if(typeof value!=="string"||!/^[a-zA-Z0-9:_-]{1,100}$/.test(value))fail_(422,"Identificador inválido.");return value;}
function config_(s,key,def){const v=Number(s.CONFIG.find(x=>x.chave===key)?.valor);return Number.isInteger(v)&&v>=1&&v<=90?v:def;}
function flow_(s,service){const f=s.FLUXOS.filter(x=>x.servico===service).sort((a,b)=>Number(a.ordem)-Number(b.ordem));if(!f.length||f.some((x,i)=>Number(x.ordem)!==i+1||!x.etapa||!Number.isInteger(Number(x.prazo_interno_dias))||Number(x.prazo_interno_dias)<1||Number(x.prazo_interno_dias)>90))fail_(422,"Fluxo de serviço inválido.");return f;}
function find_(rows,id){const x=rows.find(r=>r.id===id);if(!x)fail_(404,"Registro não encontrado.");return x;}
function task_(s,id,lead,process,tipo,titulo,due,owner,now){s.TAREFAS.push({id,lead_id:lead,processo_id:process,tipo,titulo,vencimento:due,responsavel:owner,status:"pendente",criado_em:now,concluido_em:""});}
function closeTasks_(s,lead,process,now){for(const t of s.TAREFAS)if(t.status==="pendente"&&((lead&&t.lead_id===lead&&!t.processo_id)||(process&&t.processo_id===process))){t.status="concluida";t.concluido_em=now;}}
function audit_(s,id,now,actor,action,entity){s.AUDITORIA.push({id:id+":audit",data:now,usuario:actor,acao:action,entidade_id:entity});}
function member_(s,actor){const u=s.USUARIOS.find(x=>String(x.email).toLowerCase()===actor&&["admin","operador"].includes(x.perfil)&&["sim","true","1"].includes(String(x.ativo).toLowerCase()));if(!u)fail_(403,"Acesso não autorizado.");return u;}
function intake_(s,p,actor,id,now){
 const nome=text_(p.nome,120,true),whatsapp=text_(p.whatsapp,25,true).replace(/\D/g,""),servico=text_(p.servico,100,true),mensagem=text_(p.mensagem||"",2000,false);
 if(nome.length<2||!/^\d{10,15}$/.test(whatsapp)||/^(\d)\1+$/.test(whatsapp))fail_(422,"Telefone ou nome inválido.");
 flow_(s,servico);
 if(actor==="public"){
  const hour=Date.parse(now)-3600000,day=Date.parse(now)-86400000;
  const same=s.LEADS.find(x=>x.origem==="site"&&x.whatsapp===whatsapp&&x.servico===servico&&x.nome===nome&&x.mensagem===mensagem&&Date.parse(x.criado_em)>=day);
  if(same)return {id:same.id,duplicate:true};
  const recent=s.LEADS.filter(x=>x.origem==="site"&&Date.parse(x.criado_em)>=hour);
  if(recent.length>=60||recent.filter(x=>x.whatsapp===whatsapp).length>=5)fail_(429,"Limite temporário de envios.");
 }
 if(actor!=="public"){const same=s.LEADS.find(x=>OPEN.includes(x.status)&&x.whatsapp===whatsapp&&x.servico===servico&&x.nome.toLowerCase()===nome.toLowerCase());if(same)return {id:same.id,duplicate:true};}
 const lead={id,criado_em:now,nome,whatsapp,servico,origem:actor==="public"?"site":"manual",status:"novo",responsavel:actor==="public"?"":actor,mensagem,ultimo_contato:"",proximo_followup:now,tentativas:0,atualizado_em:now};
 s.LEADS.push(lead);task_(s,id+":task",id,"","primeiro_contato","Realizar primeiro contato",now,lead.responsavel,now);audit_(s,id,now,actor,"lead.criado",id);
 return {id,duplicate:false};
}
function apply_(s,action,p,actor,id,now){
 if(actor==="public"){if(action!=="intake")fail_(403,"Acesso não autorizado.");return intake_(s,p,actor,id,now);}
 member_(s,actor);
 if(action==="dashboard"){
  const active=s.LEADS.filter(x=>OPEN.includes(x.status)),tasks=s.TAREFAS.filter(x=>x.status==="pendente").sort((a,b)=>String(a.vencimento).localeCompare(String(b.vencimento)));
  const month=now.slice(0,7),monthSales=s.VENDAS.filter(x=>x.status==="registrada"&&String(x.data).slice(0,7)===month);
  return {metrics:{leads:s.LEADS.length,active:active.length,overdue:tasks.filter(x=>x.vencimento<now).length,sales:monthSales.length,salesCents:monthSales.reduce((n,x)=>n+Number(x.valor_centavos),0),processes:s.PROCESSOS.filter(x=>x.status==="ativo").length},leads:s.LEADS.slice(-200).reverse(),tasks:tasks.slice(0,200),sales:s.VENDAS.slice(-100).reverse(),processes:s.PROCESSOS.slice(-200).reverse(),contacts:s.ATENDIMENTOS.slice(-500).reverse(),history:s.HISTORICO_SERVICOS.slice(-500).reverse(),clients:s.CLIENTES.slice(-300).reverse(),services:[...new Set(s.FLUXOS.map(x=>x.servico))]};
 }
 if(action==="createLead")return intake_(s,p,actor,id,now);
 if(action==="contact"){
  const l=find_(s.LEADS,id_(p.lead_id));if(!OPEN.includes(l.status))fail_(409,"Lead encerrado.");
  if(!CHANNELS.includes(p.canal)||!RESULTS.includes(p.resultado))fail_(422,"Resultado ou canal inválido.");
  const note=text_(p.observacao||"",1000,false);if(p.resultado==="perdido"&&!note)fail_(422,"Informe o motivo do encerramento.");
  closeTasks_(s,l.id,"",now);
  s.ATENDIMENTOS.push({id,lead_id:l.id,processo_id:"",data:now,canal:p.canal,resultado:p.resultado,observacao:note,responsavel:actor});
  l.ultimo_contato=now;l.atualizado_em=now;l.responsavel=actor;
  if(p.resultado==="perdido"){l.status="perdido";l.proximo_followup="";}
  else{
   const attempts=p.resultado==="sem_resposta"?Number(l.tentativas||0)+1:0;l.tentativas=attempts;
   l.status=p.resultado==="sem_resposta"?"aguardando_retorno":p.resultado==="proposta"?"proposta":"em_atendimento";
   const days=attempts>=3?config_(s,"followup_3_dias",7):attempts===2?config_(s,"followup_2_dias",3):config_(s,"followup_1_dias",1);
   l.proximo_followup=iso_(now,days);
   task_(s,id+":task",l.id,"",attempts>=3?"revisar_lead":"followup",attempts>=3?"Revisar continuidade do lead":"Realizar follow-up",l.proximo_followup,actor,now);
  }
  audit_(s,id,now,actor,"lead.contato",l.id);return {id:l.id};
 }
 if(action==="sale"){
  const l=find_(s.LEADS,id_(p.lead_id));if(!OPEN.includes(l.status))fail_(409,"Lead encerrado ou convertido.");
  const amount=Number(p.valor_centavos);if(!Number.isSafeInteger(amount)||amount<=0||amount>100000000)fail_(422,"Valor de venda inválido.");
  const service=text_(p.servico||l.servico,100,true);if(service==="Não sei qual serviço preciso")fail_(422,"Defina o serviço contratado.");const f=flow_(s,service);
  const customer=s.CLIENTES.find(x=>x.whatsapp===l.whatsapp&&x.nome===l.nome)||{id:id+":client",lead_id:l.id,nome:l.nome,whatsapp:l.whatsapp,criado_em:now,responsavel:actor};
  if(!s.CLIENTES.includes(customer))s.CLIENTES.push(customer);
  s.VENDAS.push({id,lead_id:l.id,cliente_id:customer.id,servico:service,valor_centavos:amount,data:now,responsavel:actor,status:"registrada"});
  const proc={id:id+":process",venda_id:id,cliente_id:customer.id,servico:service,etapa:f[0].etapa,ordem:1,status:"ativo",inicio:now,atualizado_em:now,responsavel:actor};s.PROCESSOS.push(proc);
  s.HISTORICO_SERVICOS.push({id:id+":history",processo_id:proc.id,data:now,etapa_anterior:"",etapa_nova:proc.etapa,observacao:"Venda registrada; processo iniciado.",responsavel:actor});
  closeTasks_(s,l.id,"",now);l.status="contratado";l.proximo_followup="";l.atualizado_em=now;l.responsavel=actor;
  task_(s,id+":task",l.id,proc.id,"servico",proc.etapa,iso_(now,Number(f[0].prazo_interno_dias)),actor,now);
  audit_(s,id,now,actor,"venda.registrada",id);return {id,processo_id:proc.id};
 }
 if(action==="advance"){
  const proc=find_(s.PROCESSOS,id_(p.processo_id));if(proc.status!=="ativo")fail_(409,"Processo encerrado.");
  if(Number(p.ordem_atual)!==Number(proc.ordem))fail_(409,"Etapa mudou; atualize a tela.");
  const f=flow_(s,proc.servico),n=Number(proc.ordem),next=f[n],note=text_(p.observacao||"",1000,false);
  const old=proc.etapa;closeTasks_(s,"",proc.id,now);
  proc.atualizado_em=now;proc.responsavel=actor;
  if(next){proc.etapa=next.etapa;proc.ordem=n+1;task_(s,id+":task","",proc.id,"servico",next.etapa,iso_(now,Number(next.prazo_interno_dias)),actor,now);}
  else{proc.status="concluido";proc.etapa="Concluído";}
  s.HISTORICO_SERVICOS.push({id:id+":history",processo_id:proc.id,data:now,etapa_anterior:old,etapa_nova:proc.etapa,observacao:note,responsavel:actor});
  audit_(s,id,now,actor,"processo.etapa",proc.id);return {id:proc.id,etapa:proc.etapa};
 }
 fail_(400,"Operação desconhecida.");
}
function json_(x){return ContentService.createTextOutput(JSON.stringify(x)).setMimeType(ContentService.MimeType.JSON);}
function eq_(a,b){if(typeof a!=="string"||typeof b!=="string"||a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0;}
function sign_(value,key){return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(value,key)).replace(/=+$/,"");}
function load_(spreadsheet){
 const state={},meta={};for(const [name,header] of Object.entries(TABLES)){
  const sh=spreadsheet.getSheetByName(name);if(!sh)fail_(503,"Base incompleta.");
  const cols=header.split(" "),last=sh.getLastRow();if(last>15000)fail_(503,"Capacidade da base; revisar arquivo.");
  const v=sh.getRange(1,1,Math.max(1,last),cols.length).getValues();
  if(cols.some((c,i)=>v[0][i]!==c))fail_(503,"Estrutura da base alterada.");
  state[name]=v.slice(1).filter(row=>row.some(x=>x!=="")).map(row=>Object.fromEntries(cols.map((c,i)=>[c,row[i] instanceof Date?row[i].toISOString():row[i]])));
  if(state[name].length!==last-1)fail_(503,"Base contém linhas vazias internas; manutenção necessária.");
  meta[name]={id:sh.getSheetId(),cols,maxRows:sh.getMaxRows()};
 }return {state,meta};
}
function cell_(v){return {userEnteredValue:typeof v==="number"?{numberValue:v}:{stringValue:String(v??"")}};}
function commit_(id,before,after,meta){
 const requests=[];for(const [name,m] of Object.entries(meta)){
  const a=before[name],b=after[name];if(b.length<a.length)fail_(500,"Operação inválida.");
  if(b.length+1>m.maxRows)requests.push({appendDimension:{sheetId:m.id,dimension:"ROWS",length:Math.max(1000,b.length+1-m.maxRows)}});
  for(let i=0;i<b.length;i++)if(JSON.stringify(a[i])!==JSON.stringify(b[i]))requests.push({updateCells:{start:{sheetId:m.id,rowIndex:i+1,columnIndex:0},rows:[{values:m.cols.map(c=>cell_(b[i][c]))}],fields:"userEnteredValue"}});
 }if(requests.length)Sheets.Spreadsheets.batchUpdate({requests},id);
}
function doPost(e){
 let lock;
 try{
  const props=PropertiesService.getScriptProperties(),key=props.getProperty("PINCIO_CRM_SHARED_SECRET"),sheetId=props.getProperty("PINCIO_CRM_SHEET_ID");
  if(!key||key.length<32||!sheetId||!e?.postData?.contents||e.postData.contents.length>30000)fail_(503,"Integração indisponível.");
  const env=JSON.parse(e.postData.contents);
  if(typeof env.payload!=="string"||typeof env.ts!=="number"||Math.abs(Date.now()-env.ts)>300000||!eq_(env.sig,sign_(String(env.ts)+"."+env.payload,key)))fail_(403,"Acesso não autorizado.");
  const body=JSON.parse(env.payload),actor=String(body.actor||"").toLowerCase(),action=String(body.action||""),op=id_(body.id),payload=body.data||{};
  if(!payload||Array.isArray(payload)||typeof payload!=="object")fail_(422,"Dados inválidos.");
  lock=LockService.getScriptLock();if(!lock.tryLock(8000))fail_(503,"Tente novamente.");
  const {state,meta}=load_(SpreadsheetApp.openById(sheetId));
  if(state.CONFIG.find(x=>x.chave==="modo")?.valor!=="ativo")fail_(503,"Base em homologação.");
  if(actor!=="public")member_(state,actor);
  const hash=sign_(JSON.stringify([actor,action,payload]),key),prev=state.OPERACOES.find(x=>x.id===op);
  if(prev){if(prev.hash!==hash)fail_(409,"Identificador já utilizado.");return json_({ok:true,data:JSON.parse(prev.resultado)});}
  const before=JSON.parse(JSON.stringify(state)),now=new Date().toISOString();
  const data=apply_(state,action,payload,actor,op,now);
  if(action!=="dashboard"){state.OPERACOES.push({id:op,hash,resultado:JSON.stringify(data),criado_em:now});commit_(sheetId,before,state,meta);}
  return json_({ok:true,data});
 }catch(err){return json_({ok:false,status:err.status||503,error:err.status?err.message:"Serviço temporariamente indisponível."});}
 finally{if(lock)try{lock.releaseLock();}catch(_){}}
}
