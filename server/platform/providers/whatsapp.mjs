// Policy evaluation only. There is intentionally no transport or message-sending code.
export function whatsappPlan({optIn,lastInboundAt,now=Date.now(),approvedTemplate=false,humanApproved=false,paused=false,closed=false}) {
 if(!optIn||paused||closed)return {allowed:false,reason:'Contato proativo desautorizado ou caso inativo',sent:false};
 const within24h=Number.isFinite(Date.parse(lastInboundAt))&&now-Date.parse(lastInboundAt)>=0&&now-Date.parse(lastInboundAt)<86400000;
 return {allowed:false,canPrepare:humanApproved&&(within24h||approvedTemplate),requiresTemplate:!within24h,requiresHuman:!humanApproved,reason:'Número empresarial e provedor pendentes; transporte desativado',sent:false};
}
