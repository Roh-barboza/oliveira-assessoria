/** Run manually in the editor, under the owner of the new private test spreadsheet. */
function initializeCrmSandbox() {
 const properties=PropertiesService.getScriptProperties();
 const id=properties.getProperty("PINCIO_CRM_SHEET_ID");
 const email=String(properties.getProperty("PINCIO_CRM_ADMIN_EMAIL")||"").trim().toLowerCase();
 if(!id||!/^\S+@\S+\.\S+$/.test(email))fail_(422,"Configure o ID da base e o e-mail do administrador nas propriedades.");
 const lock=LockService.getScriptLock();
 if(!lock.tryLock(8000))fail_(503,"Tente novamente.");
 try{
  const spreadsheet=SpreadsheetApp.openById(id);
  const existing=spreadsheet.getSheets();
  if(existing.length!==1||existing[0].getLastRow()!==0)fail_(409,"Use uma planilha nova com uma única aba vazia.");

  const services=[
   "Passaporte italiano","AIRE","Fast It","Estado civil","Montagem de pasta para processos",
   "Imposto de Renda","Processo administrativo","Não sei qual serviço preciso"
  ];
  const seed={
   USUARIOS:[[email,"admin","sim"]],
   CONFIG:[["modo","homologacao","Base de testes"],["followup_1_dias",1,"Primeiro retorno"],["followup_2_dias",3,"Segundo retorno"],["followup_3_dias",7,"Revisão manual"]],
   FLUXOS:services.flatMap(service=>[[service,1,"Triagem",1],[service,2,"Revisão",3],[service,3,"Entrega",3]]),
  };
  const requests=[];
  const initialId=existing[0].getSheetId();
  for(const [index,[name,header]] of Object.entries(TABLES).entries()){
   // Reuse the blank tab and choose unique IDs for the tabs created in this batch.
   const sheetId=index===0?initialId:index+(initialId<=index?1:0);
   if(index===0)requests.push({updateSheetProperties:{properties:{sheetId,title:name,gridProperties:{frozenRowCount:1}},fields:"title,gridProperties.frozenRowCount"}});
   else requests.push({addSheet:{properties:{sheetId,title:name,gridProperties:{frozenRowCount:1}}}});
   const rows=[header.split(" "),...(seed[name]||[])];
   requests.push({updateCells:{start:{sheetId,rowIndex:0,columnIndex:0},rows:rows.map(row=>({values:row.map(cell_)})),fields:"userEnteredValue"}});
  }
  Sheets.Spreadsheets.batchUpdate({requests},id);
  return {tabs:Object.keys(TABLES).length,mode:"homologacao"};
 }finally{lock.releaseLock();}
}
