const ZONE="America/Sao_Paulo";
const OPEN_STAGES=new Set(["novo","em_atendimento","aguardando_retorno","proposta"]);

function automationRows_(sheet,required){
 if(!sheet||sheet.getLastRow()<1||sheet.getLastRow()>15000)throw new Error("Estrutura da base indisponível.");
 const [header,...values]=sheet.getDataRange().getValues();
 const positions=required.map(name=>header.indexOf(name));
 if(positions.some(index=>index<0))throw new Error("Cabeçalho da base incompatível.");
 return values.filter(row=>row.some(value=>value!=="")).map(row=>Object.fromEntries(required.map((name,index)=>[name,row[positions[index]]])));
}

function summary_(spreadsheet,now,staleDays){
 const open=name=>spreadsheet.getSheetByName(name);
 const today=Utilities.formatDate(now,ZONE,"yyyy-MM-dd");
 const deadline=now.getTime()-staleDays*86400000;
 const leads=automationRows_(open("LEADS"),["status","ultimo_contato","proximo_followup"]);
 const tasks=automationRows_(open("TAREFAS"),["vencimento","status"]);
 const processes=automationRows_(open("PROCESSOS"),["status","atualizado_em"]);
 const lines=[
  "Leads novos sem atendimento: "+leads.filter(row=>row.status==="novo"&&!row.ultimo_contato).length,
  "Retornos vencidos: "+leads.filter(row=>OPEN_STAGES.has(row.status)&&Date.parse(row.proximo_followup)<now.getTime()).length,
  "Tarefas vencidas: "+tasks.filter(row=>row.status==="pendente"&&Date.parse(row.vencimento)<now.getTime()).length,
  "Processos sem atualização há "+staleDays+" dias ou mais: "+processes.filter(row=>row.status==="ativo"&&Date.parse(row.atualizado_em)<=deadline).length,
 ];
 const installments=open("PARCELAS"), receipts=open("RECEBIMENTOS");
 if(installments&&receipts){
  const paid=new Map();
  for(const row of automationRows_(receipts,["parcela_id","valor_centavos"])){
   paid.set(row.parcela_id,(paid.get(row.parcela_id)||0)+Number(row.valor_centavos));
  }
  const date=value=>value instanceof Date?Utilities.formatDate(value,spreadsheet.getSpreadsheetTimeZone(),"yyyy-MM-dd"):String(value);
  const late=automationRows_(installments,["id","vencimento","valor_centavos"]).filter(row=>date(row.vencimento)<today&&Number(row.valor_centavos)>(paid.get(row.id)||0));
  lines.push("Parcelas vencidas com saldo: "+late.length);
 }
 lines.push("Abra o CRM para consultar responsáveis, prioridades e registros.");
 return lines.join("\n");
}

function privateBackupFolder_(folderId){
 if(!folderId)throw new Error("Pasta de backup não configurada.");
 const folder=DriveApp.getFolderById(folderId);
 const owner=folder.getOwner();
 const ownerEmail=owner?.getEmail();
 if(!ownerEmail||ownerEmail!==Session.getEffectiveUser().getEmail()||folder.getSharingAccess()!==DriveApp.Access.PRIVATE||
   folder.getEditors().some(user=>user.getEmail()!==ownerEmail)||folder.getViewers().some(user=>user.getEmail()!==ownerEmail)){
  throw new Error("Use uma pasta exclusiva, privada e pertencente ao executor.");
 }
 return folder;
}

function sendSummary_(spreadsheet,properties,now){
 const configured=properties.getProperty("PINCIO_CRM_ADMIN_EMAIL")||"";
 const recipient=configured.trim().toLowerCase();
 const users=automationRows_(spreadsheet.getSheetByName("USUARIOS"),["email","perfil","ativo"]);
 if(!/^\S+@\S+\.\S+$/.test(recipient)||!users.some(user=>String(user.email).toLowerCase()===recipient&&user.perfil==="admin"&&["1","sim","true"].includes(String(user.ativo).toLowerCase()))){
  throw new Error("Destinatário interno não autorizado.");
 }
 if(MailApp.getRemainingDailyQuota()<1)throw new Error("Cota diária de e-mail indisponível.");
 const staleDays=Number(properties.getProperty("PINCIO_CRM_STALE_PROCESS_DAYS")||7);
 if(!Number.isInteger(staleDays)||staleDays<1||staleDays>90)throw new Error("Prazo para alerta de processos inválido.");
 MailApp.sendEmail(recipient,"PINCIO CRM · Resumo diário",summary_(spreadsheet,now,staleDays));
}

function backup_(sourceId,properties,today){
 const folder=privateBackupFolder_(properties.getProperty("PINCIO_CRM_BACKUP_FOLDER_ID"));
 const name="PINCIO CRM — Backup — "+today;
 if(!folder.getFilesByName(name).hasNext())DriveApp.getFileById(sourceId).makeCopy(name,folder);
}

function runCrmDailyAutomation() {
 const properties=PropertiesService.getScriptProperties();
 const send=properties.getProperty("PINCIO_CRM_DAILY_EMAIL_ENABLED")==="1";
 const backup=properties.getProperty("PINCIO_CRM_BACKUP_ENABLED")==="1";
 if(!send&&!backup)return;
 const id=properties.getProperty("PINCIO_CRM_SHEET_ID");
 if(!id)throw new Error("Base da automação não configurada.");
 const lock=LockService.getScriptLock();
 if(!lock.tryLock(5000))throw new Error("Automação já em execução.");
 try{
  const now=new Date(),today=Utilities.formatDate(now,ZONE,"yyyy-MM-dd");
  let failures=0;
  if(backup&&properties.getProperty("lastBackup")!==today){
   try{
    backup_(id,properties,today);
    properties.setProperty("lastBackup",today);
   }catch(_){failures++;}
  }
  if(send&&properties.getProperty("lastSummary")!==today){
   try{
    sendSummary_(SpreadsheetApp.openById(id),properties,now);
    properties.setProperty("lastSummary",today);
   }catch(_){failures++;}
  }
  if(failures)throw new Error("Uma ou mais rotinas do PINCIO CRM falharam. Confira a configuração e as cotas.");
 }finally{lock.releaseLock();}
}

function installCrmDailyAutomation() {
 const handler="runCrmDailyAutomation";
 if(ScriptApp.getProjectTriggers().some(trigger=>trigger.getHandlerFunction()===handler))return;
 ScriptApp.newTrigger(handler).timeBased().everyDays(1).atHour(8).inTimezone(ZONE).create();
}
