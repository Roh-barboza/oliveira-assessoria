# Captação direta PINCIO
- Formulários → POST /api/leads → PostgreSQL dedicado. Não há fallback externo nem confirmação falsa.
- A API só aceita origens públicas do próprio projeto e apenas grava em produção com opt-in explícito.
- Neon Free é uma opção de PostgreSQL; verificar cotas, termos, tratamento de dados e região antes de usar. Não é necessário usar n8n.
- Criar banco separado dos ambientes operacional e sintético; aplicar db/pincio-leads.sql com uma conta de migração. Criar usuário de aplicação com SELECT nas duas tabelas, UPDATE em pincio_lead_guard (necessário para lock) e INSERT em pincio_leads. Não dar acesso público. Usar conexão TLS e role de leitura dedicada para exportação.
- Configurar na produção PINCIO_LEADS_DATABASE_URL (conexão exclusiva) e PINCIO_LEADS_DATA_KEY (chave aleatória exclusiva de 32 bytes em hexadecimal), ambos como segredos. PINCIO_LEADS_ENABLED=1 somente após validar banco e autorização de dados reais. Não colar chaves em chats nem no GitHub. Guardar chave com backup protegido.
- O esquema prevê status comerciais. scripts/pincio-leads-export.mjs permite exportação JSON privada com conexão de leitura, chave e confirmação explícita; ainda não é CRM visual, e não envia e-mails.
- Criptografia AES-256-GCM; HMAC separado por finalidade para deduplicação de 24h e limite de 5 envios novos/telefone/hora e 60 globais/hora, serializados em banco. Limite global pode afetar usuários durante ataques; antes de ampliar a operação, adicionar proteção por Turnstile ou outra solução validada e monitoramento. Não confiar em IP fornecido pelo cliente.
- Ensaiar restauração, definir retenção e expurgo, política de acesso e direitos LGPD, confirmar identidade jurídica e canal institucional antes de ativar. Não exportar dados para arquivos públicos.
- Testes são sintéticos. A aprovação de CI não comprova recebimento em banco real. Confirmar com teste controlado após configuração.
- Site continua com noindex. Clicksign, domínio, API operacional real e agente editorial não são alterados. A demonstração é volátil e apenas sintética. A hospedagem comercial gratuita requer verificar regras da Vercel Hobby ou migração separada.

- A confirmação apresenta o protocolo único ao visitante. A marca antiga herdada do catálogo histórico é normalizada na saída do simulador, sem alterar o histórico de planejamento.
