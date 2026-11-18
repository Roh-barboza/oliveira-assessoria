// Explicitly injected enterprise credential provider; never reads a developer's Google session.
export function privateDrive({token,rootId,fetcher=fetch,enabled=false}) {
  const validId=id=>typeof id==='string'&&/^[A-Za-z0-9_-]{8,160}$/.test(id);
  async function request(path,options={}) {
    if(!enabled||!validId(rootId)||typeof token!=='function')throw Error('Conta empresarial privada não configurada.');
    const response=await fetcher('https://www.googleapis.com/drive/v3/'+path,{...options,redirect:'error',signal:AbortSignal.timeout(7500),headers:{Authorization:'Bearer '+await token(),'Content-Type':'application/json',...options.headers}});
    if(!response.ok)throw Error('Drive indisponível');return response.json();
  }
  return {
    async provision(caseId) {
      if(!validId(caseId))throw Error('Identificador inválido');
      const permissions=await request(`files/${rootId}/permissions?fields=permissions(id,type,role)&supportsAllDrives=true`);
      if(!Array.isArray(permissions.permissions)||permissions.permissions.some(p=>!['user','group'].includes(p.type)))throw Error('Pasta com permissões públicas ou de domínio não permitida.');
      // No permission creation or public sharing. The business root must already have approved restricted access.
      const folder=await request('files?supportsAllDrives=true&fields=id',{method:'POST',body:JSON.stringify({name:'atendimento-'+caseId,mimeType:'application/vnd.google-apps.folder',parents:[rootId]})});
      if(!validId(folder.id))throw Error('Pasta inválida');return {id:folder.id,access:'inherited-restricted',individualClientAccess:false,requiresPermissionReview:true};
    },
    async metadata(fileId) {if(!validId(fileId))throw Error('Identificador inválido');return request(`files/${fileId}?fields=id,name,mimeType,parents&supportsAllDrives=true`);}
  };
}
