"use strict";
const $=id=>document.getElementById(id);
const state={data:null,busy:false,pending:null};
const money=c=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(Number(c||0)/100);
const percent=new Intl.NumberFormat("pt-BR",{style:"percent",maximumFractionDigits:1});
const date=x=>x?new Date(x).toLocaleString("pt-BR",{timeZone:"America/Sao_Paulo"}):"—";
const labels={novo:"Novo",em_atendimento:"Em atendimento",aguardando_retorno:"Aguardando retorno",proposta:"Proposta enviada",contratado:"Contratado",perdido:"Encerrado",ativo:"Ativo",concluido:"Concluído"};
function el(tag,text,cls){const e=document.createElement(tag);if(text!==undefined)e.textContent=String(text);if(cls)e.className=cls;return e;}
function field(label,name,type,values){const wrap=el("label",label);const input=el(type==="select"?"select":type==="textarea"?"textarea":"input");input.name=name;if(type==="select")for(const [v,t] of values){const o=el("option",t);o.value=v;input.append(o);}else if(type!=="textarea")input.type=type;wrap.append(input);return wrap;}
function submitForm(fields,label,handler){const form=el("form");fields.forEach(f=>form.append(f));const b=el("button",label);form.append(b);form.addEventListener("submit",e=>{e.preventDefault();handler(Object.fromEntries(new FormData(form)));});return form;}
async function request(op,data){const opts={cache:"no-store",credentials:"same-origin"};if(data){const sig=JSON.stringify([op,data]);if(!state.pending||state.pending.sig!==sig)state.pending={sig,id:crypto.randomUUID()};Object.assign(opts,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:state.pending.id,data})});}const r=await fetch("/api/crm?op="+encodeURIComponent(op),opts);let j;try{j=await r.json();}catch{throw Error("Resposta indisponível.");}if(!r.ok||!j.ok){if(r.status===401||r.status===403){$("app").hidden=true;$("gate").hidden=false;$("logout").hidden=true;}throw Error(j.error||"Falha na operação.");}if(data)state.pending=null;return j.data;}
async function refresh(){state.data=await request("dashboard");$("gate").hidden=true;$("app").hidden=false;$("logout").hidden=false;render();}
async function mutate(op,data){if(state.busy)return;state.busy=true;document.querySelectorAll("#app button").forEach(b=>b.disabled=true);$("notice").textContent="Salvando…";try{const result=await request(op,data);if(op==="createLead")$("new-lead").reset();await refresh();$("notice").textContent=result.duplicate?"Lead já existente; nenhum registro duplicado.":"Registro salvo. Tarefas atualizadas.";}catch(e){$("notice").textContent=e.message;}finally{state.busy=false;document.querySelectorAll("#app button").forEach(b=>b.disabled=false);}}
function searchMatches(...values){
 const normalize=value=>String(value??"").toLocaleLowerCase("pt-BR").normalize("NFD").replace(/\p{Diacritic}/gu,"");
 const query=normalize($("search").value.trim());
 return !query||values.some(value=>normalize(value).includes(query));
}
function renderLeads(){const node=$("lead-list");node.replaceChildren();
 const columns=new Map(Object.entries(labels).slice(0,6).map(([status,label])=>{
  const lane=el("div",undefined,"lane");
  lane.append(el("h3",label));
  node.append(lane);
  return [status,lane];
 }));
 const origin=$("filter-origin").value;
 const service=$("filter-service").value;
 for(const l of state.data.leads.filter(l=>(!origin||l.origem===origin)&&(!service||l.servico===service)&&searchMatches(l.nome,l.whatsapp,l.servico,l.id,l.responsavel,l.origem))){const item=el("article",undefined,"record");item.append(el("h4",l.nome),el("p",l.whatsapp+" | "+l.servico),el("p","Origem: "+l.origem+" · "+(l.responsavel||"Não atribuído")),el("p","Próximo retorno: "+date(l.proximo_followup)),el("p",l.mensagem||""));if(!["contratado","perdido"].includes(l.status)){
 const staff=state.data.settings?.staff;
 if(staff?.length){
  const owner=field("Responsável","responsavel","select",[["","Selecionar"],...staff.map(email=>[email,email])]);
  const select=owner.querySelector("select");
  select.value=staff.includes(l.responsavel)?l.responsavel:"";
  select.required=true;
  item.append(submitForm([owner],"Atribuir lead",values=>mutate("assignLead",{...values,lead_id:l.id})));
 }
 const contact=submitForm([field("Canal","canal","select",["WhatsApp","E-mail","Telefone","Reunião","Outro"].map(x=>[x,x])),field("Resultado","resultado","select",[["respondeu","Respondeu"],["sem_resposta","Sem resposta"],["proposta","Proposta enviada"],["perdido","Encerrar"]]),field("Observação / motivo","observacao","textarea")],"Registrar contato",p=>mutate("contact",{...p,lead_id:l.id}));
 const sale=submitForm([field("Serviço contratado","servico","select",state.data.services.filter(s=>s!=="Não sei qual serviço preciso").map(x=>[x,x])),field("Valor contratado em reais","valor","number")],"Registrar venda",p=>{const amount=Number(p.valor);if(!Number.isFinite(amount)||amount<=0||!Number.isSafeInteger(Math.round(amount*100)))return $("notice").textContent="Informe um valor válido.";mutate("sale",{lead_id:l.id,servico:p.servico,valor_centavos:Math.round(amount*100)});});const sel=sale.querySelector("select");if([...sel.options].some(o=>o.value===l.servico))sel.value=l.servico;const amount=sale.querySelector('input[name="valor"]');amount.min="0.01";amount.step="0.01";amount.required=true;item.append(contact,sale);}
 const history=(state.data.contacts||[]).filter(x=>x.lead_id===l.id);if(history.length){const details=el("details");details.append(el("summary","Histórico de contatos ("+history.length+")"));for(const h of history)details.append(el("p",date(h.data)+" · "+h.canal+" · "+h.resultado+(h.observacao?" | "+h.observacao:"")));item.append(details);}(columns.get(l.status)||node).append(item);}
 for(const lane of columns.values())if(lane.children.length===1)lane.append(el("p","Nenhum lead."));
}
function render(){const d=state.data,m=d.metrics;$("metrics").replaceChildren();for(const [k,v] of [["Leads",m.leads],["Em atendimento",m.active],...(Number.isFinite(m.converted)?[["Taxa de conversão",percent.format(m.leads?m.converted/m.leads:0)]]:[]),["Tarefas vencidas",m.overdue],["Vendas no mês",m.sales],["Valor contratado no mês",money(m.salesCents)],["Serviços ativos",m.processes]]){const card=el("div",undefined,"metric");card.append(el("span",k),el("strong",v));$("metrics").append(card);}
 const service=$("service");const selected=service.value;service.replaceChildren();for(const s of d.services){const o=el("option",s);o.value=s;service.append(o);}if(d.services.includes(selected))service.value=selected;
 const filter=$("filter-service");
 const currentFilter=filter.value;
 filter.replaceChildren(new Option("Todos",""),...d.services.map(name=>new Option(name,name)));
 if(d.services.includes(currentFilter))filter.value=currentFilter;
 renderRecords();
 $("finance-tab").hidden=!d.finance;
 renderSettings(d.settings);
}
function recordMatches(record){
 const d=state.data;
 const lead=d.leads.find(item=>item.id===record.lead_id);
 const process=d.processes.find(item=>item.id===record.processo_id);
 const client=(d.clients||[]).find(item=>item.id===(record.cliente_id||process?.cliente_id));
 return searchMatches(record.nome,record.whatsapp,record.id,record.titulo,record.servico,record.responsavel,record.etapa,
  lead?.nome,lead?.whatsapp,process?.servico,client?.nome,client?.whatsapp);
}
function centField(name){
 const wrap=field("Valor em reais",name,"number");
 const input=wrap.querySelector("input");
 Object.assign(input,{required:true,min:"0.01",step:"0.01",max:"1000000.00"});
 return wrap;
}
function dueField(label,name){
 const wrap=field(label,name,"date");
 wrap.querySelector("input").required=true;
 return wrap;
}
function planForm(sale,methods){
 const form=el("form");
 form.className="payment-plan";
 const rows=el("div",undefined,"payment-rows");
 const add=el("button","Adicionar parcela");
 add.type="button";
 const remove=el("button","Remover última parcela");
 remove.type="button";
 const append=()=>{
  if(rows.children.length===24)return;
  const line=el("fieldset");
  line.append(el("legend","Parcela "+(rows.children.length+1)),dueField("Vencimento","vencimento"),centField("valor"));
  rows.append(line);
  remove.disabled=rows.children.length===1;
  add.disabled=rows.children.length===24;
 };
 add.addEventListener("click",append);
 remove.addEventListener("click",()=>{
  if(rows.children.length>1)rows.lastElementChild.remove();
  remove.disabled=rows.children.length===1;
  add.disabled=false;
 });
 append();
 const method=field("Forma de pagamento","forma_pagamento","select",methods.map(value=>[value,value]));
 form.append(method,rows,add,remove,el("button","Salvar plano"));
 form.addEventListener("submit",event=>{
  event.preventDefault();
  const values=new FormData(form);
  const amounts=values.getAll("valor");
  const parcelas=values.getAll("vencimento").map((date,index)=>({vencimento:date,valor_centavos:Math.round(Number(amounts[index])*100)}));
  mutate("paymentPlan",{venda_id:sale.id,forma_pagamento:values.get("forma_pagamento"),parcelas});
 });
 return form;
}
function renderFinance(finance,sales){
 if(!finance)return;
 const metrics=$("finance-metrics");
 metrics.replaceChildren();
 for(const [label,value] of [["Recebido no mês",finance.monthPaid],["A receber",finance.pending],["Saldo vencido",finance.overdue]]){
  const card=el("div",undefined,"metric");
  card.append(el("span",label),el("strong",money(value)));
  metrics.append(card);
 }
 const plans=$("payment-plans"), installments=$("installments");
 plans.replaceChildren();
 installments.replaceChildren();
 const planned=new Set(finance.plannedSales);
 for(const sale of sales.filter(sale=>sale.status==="registrada"&&!planned.has(sale.id)&&recordMatches(sale))){
  const item=el("details",undefined,"record");
  item.append(el("summary",sale.servico+" · "+money(sale.valor_centavos)+" · "+sale.id),planForm(sale,finance.methods));
  plans.append(item);
 }
 for(const row of finance.installments){
  const sale=sales.find(sale=>sale.id===row.venda_id);
  if(!recordMatches({...sale,...row}))continue;
  const item=el("article",undefined,"record");
  item.append(el("h4",(sale?.servico||row.venda_id)+" · Parcela "+row.ordem),el("p",row.vencimento.split("-").reverse().join("/")+" · "+row.forma_pagamento),el("p","Saldo: "+money(row.balance)+" · Recebido: "+money(row.paid)));
  if(row.balance>0){
   item.append(submitForm([dueField("Data do recebimento","data"),centField("valor")],"Registrar recebimento",values=>{
    mutate("receivePayment",{parcela_id:row.id,data:values.data,valor_centavos:Math.round(Number(values.valor)*100)});
   }));
  }
  installments.append(item);
 }
 if(!plans.children.length)plans.append(el("p","Nenhuma venda aguardando plano."));
 if(!installments.children.length)installments.append(el("p","Nenhuma parcela."));
}
function renderSettings(settings){
 $("settings-tab").hidden=!settings;
 if(!settings)return;
 const fields=settings.followup.map((days,index)=>{
  const wrap=field(String(index+1)+"º retorno em dias","days"+index,"number");
  const input=wrap.querySelector("input");
  Object.assign(input,{required:true,min:"1",max:"90",step:"1",value:String(days)});
  return wrap;
 });
 const form=submitForm(fields,"Salvar cadência",values=>{
  const days=[0,1,2].map(index=>Number(values["days"+index]));
  mutate("setFollowup",{days});
 });
 $("followup-settings").replaceChildren(form);
}
function renderRecords(){
 const d=state.data;
 renderLeads();
 renderFinance(d.finance,d.sales);
 for(const [id,rows,fn] of [["task-list",d.tasks,t=>{const e=el("article",undefined,"record"+(t.vencimento<new Date().toISOString()?" late":""));const l=d.leads.find(l=>l.id===t.lead_id),p=d.processes.find(p=>p.id===t.processo_id);e.append(el("h3",t.titulo),el("p",(l?.nome||p?.servico||t.lead_id||t.processo_id)+" · "+date(t.vencimento)),el("p",(t.vencimento<new Date().toISOString()?"Vencida · ":"Programada · ")+"Responsável: "+(t.responsavel||"Não atribuído")));return e;}],["client-list",d.clients||[],client=>{
 const item=el("article",undefined,"record");
 item.append(el("h3",client.nome),el("p",client.whatsapp),el("p","Responsável: "+(client.responsavel||"Não atribuído")));
 const processes=d.processes.filter(process=>process.cliente_id===client.id);
 if(processes.length){
  const list=el("ul");
  for(const process of processes)list.append(el("li",process.servico+" · "+process.etapa));
  item.append(list);
 }
 return item;
}],["sale-list",d.sales,s=>{const e=el("article",undefined,"record");e.append(el("h3",s.servico+" · "+money(s.valor_centavos)),el("p",date(s.data)+" · "+(d.leads.find(l=>l.id===s.lead_id)?.nome||s.lead_id)));return e;}],["process-list",d.processes,p=>{const e=el("article",undefined,"record");e.append(el("h3",p.servico+" · "+p.etapa),el("p",((d.clients||[]).find(c=>c.id===p.cliente_id)?.nome||p.cliente_id)+" | "+(labels[p.status]||p.status)+" | Atualizado: "+date(p.atualizado_em)));const hist=(d.history||[]).filter(h=>h.processo_id===p.id);if(hist.length){const details=el("details");details.append(el("summary","Histórico de etapas ("+hist.length+")"));for(const h of hist)details.append(el("p",date(h.data)+" · "+h.etapa_nova+(h.observacao?" | "+h.observacao:"")));e.append(details);}if(p.status==="ativo"){
 const note=field("Pendência documental ou observação","observacao","textarea");
 Object.assign(note.querySelector("textarea"),{required:true,maxLength:1000});
 const payload=values=>({processo_id:p.id,ordem_atual:p.ordem,observacao:values.observacao});
 e.append(
  submitForm([note],"Registrar pendência",values=>mutate("processNote",payload(values))),
  submitForm([field("Registro da etapa","observacao","textarea")],"Concluir etapa",values=>mutate("advance",payload(values))),
 );
}return e;}]]){const n=$(id);n.replaceChildren(...rows.filter(recordMatches).map(fn));if(!n.children.length)n.append(el("p","Nenhum registro."));}}
document.querySelectorAll("[data-tab]").forEach(b=>b.addEventListener("click",()=>document.querySelectorAll(".pane").forEach(p=>p.hidden=p.id!==b.dataset.tab)));
$("new-lead").addEventListener("submit",e=>{e.preventDefault();mutate("createLead",Object.fromEntries(new FormData(e.target)));});
$("search").addEventListener("input",()=>{if(state.data)renderRecords();});
for(const id of ["filter-origin","filter-service"])$(id).addEventListener("change",renderLeads);
$("login").disabled=false;
$("login").addEventListener("click",()=>location.assign("/api/crm?op=login"));
$("logout").addEventListener("click",async()=>{try{const response=await fetch("/api/crm?op=logout",{method:"POST",credentials:"same-origin"});if(!response.ok)throw Error();location.assign("/crm.html");}catch{$("notice").textContent="Não foi possível sair. Tente novamente.";}});
refresh().catch(e=>{
 const error=new URLSearchParams(location.search).get("erro");
 $("gate-text").textContent=error==="acesso"?"Use uma conta Google autorizada.":error==="login"?"O login expirou. Tente novamente.":e.message;
});
