import { createApp, responseHeaders, runtime } from '../server/contratacao/app.mjs';
import { postgres } from '../server/contratacao/store.mjs';

let app;
function handler(request) {
  try {
    if (!app) {
      const env = process.env;
      const settings = runtime(env);
      if (!settings) return Response.json({ error: 'Ambiente de testes indisponível.' }, { status: 404, headers: responseHeaders });
      if (!env.CONTRACT_DATABASE_URL) throw new Error('Banco indisponível');
      const url = new URL(env.CONTRACT_DATABASE_URL);
      if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.pathname.slice(1) || (!settings.local && [...url.searchParams.keys()].some(key => /ssl/i.test(key)))) {
        throw new Error('URL do banco inválida');
      }
      app = createApp({ pool: postgres(url.toString(), settings.local), env, settings });
    }
    return app(request);
  } catch {
    return Response.json({ error: 'Configuração do ambiente de testes incompleta.' }, { status: 503, headers: responseHeaders });
  }
}

export default { fetch: handler };
