"use strict";
(() => {
  const $ = id => document.getElementById(id);
  let activeToken = null;
  let busy = false;
  const feedback=(message,bad=false)=>{
    const node=$("enroll-feedback");
    node.textContent=message;
    node.classList.toggle("error",bad);
    node.hidden=!message;
  };
  const setBusy=value=>{
    busy=value;
    for(const b of document.querySelectorAll("#enroll-form button, #totp-form button"))
      b.disabled=value;
  };
  async function post(op, body) {
    const res=await fetch("/api/operacional?op="+op,{
      method:"POST",credentials:"same-origin",cache:"no-store",
      headers:{"Content-Type":"application/json"},body:JSON.stringify(body),
    });
    const type=res.headers.get("content-type")||"";
    if(!type.includes("application/json"))throw new Error("Ativação indisponível neste ambiente.");
    const data=await res.json();
    if(!res.ok) {
      const err=new Error(typeof data.error==="string"?data.error:"Não foi possível concluir.");
      err.status=res.status;throw err;
    }
    return data;
  }
  $("enroll-form").addEventListener("submit",async event=>{
    event.preventDefault();
    if(busy)return;
    const form=event.currentTarget;
    const token=String(form.elements.token.value||"").trim();
    const password=String(form.elements.password.value||"");
    const repeat=String(form.elements.passwordRepeat.value||"");
    if(password!==repeat){feedback("As senhas não coincidem.",true);return;}
    feedback("");setBusy(true);
    try{
      const result=await post("invite-redeem",{token,password});
      if(typeof result.enrollment?.totpSecret!=="string"||
        result.enrollment.totpSecret.length<16)throw new Error("Ativação incompleta.");
      activeToken=token;
      $("totp-secret").value=result.enrollment.totpSecret;
      form.reset();
      form.hidden=true;
      $("totp-panel").hidden=false;
      feedback("Cadastre a chave no autenticador e confirme o código.");
    }catch(e){feedback(e.message||"Falha ao iniciar ativação.",true);}
    finally{form.elements.password.value="";form.elements.passwordRepeat.value="";setBusy(false);}
  });
  $("totp-form").addEventListener("submit",async event=>{
    event.preventDefault();
    if(busy||!activeToken)return;
    const form=event.currentTarget;
    const code=String(form.elements.code.value||"");
    feedback("");setBusy(true);
    try{
      const result=await post("invite-confirm",{token:activeToken,code});
      if(result.activated!==true)throw new Error("Confirmação não realizada.");
      activeToken=null;$("totp-secret").value="";form.reset();
      $("totp-panel").hidden=true;$("enroll-complete").hidden=false;
      feedback("Conta ativada com sucesso.");
    }catch(e){
      form.elements.code.value="";
      feedback(e.message||"Falha ao confirmar código.",true);
    }finally{setBusy(false);}
  });
})();
