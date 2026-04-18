# Oliveira Assessoria Jurídica — Contexto do Projeto

> Este arquivo é a memória do projeto. Qualquer IA ou desenvolvedor que continuar o trabalho deve ler este arquivo primeiro.

---

## O que é o projeto

Plataforma de **assessoria jurídica digital** para pessoas físicas que precisam de orientação em áreas que **não exigem OAB**: INSS/Previdência, Precatórios, Imposto de Renda e Negociação de Dívidas. O modelo de negócio é assessoria (orientação + execução burocrática), não advocacia.

**Responsável:** Rodrigo Barboza (`rodrigo.barboza1994@gmail.com`)

---

## Stack tecnológica

| Camada | Tecnologia |
|---|---|
| Landing page | HTML5 + CSS3 + JS vanilla |
| Deploy | Vercel (conectado ao GitHub `Roh-barboza/oliveira-assessoria`) |
| Banco de dados | PostgreSQL + extensão pgvector |
| IA (embeddings) | Google Gemini (`text-embedding-004`) |
| IA (chatbot) | OpenAI GPT-4o-mini |
| Automação | n8n (self-hosted em `chaoticcow-n8n.cloudfy.live`) |
| WhatsApp | Evolution API (`chaoticcow-evolution.cloudfy.live`) |

---

## Estrutura do repositório

```
oliveira-assessoria/
├── landing/
│   ├── index.html      # Site principal (HTML completo)
│   ├── style.css       # Estilos (externo, linkado no HTML)
│   └── script.js       # (vazio — JS está inline no index.html)
├── agent/
│   ├── package.json    # Dependências: @google/generative-ai, pg, dotenv
│   └── seed-knowledge.js # Popula banco com artigos jurídicos + embeddings Gemini
├── db/
│   └── schema.sql      # Schema PostgreSQL completo (rodar 1x para criar tabelas)
├── n8n/
│   ├── 01-recepcao-leads.json  # Workflow: processa form da landing → WhatsApp boas-vindas
│   ├── 02-bot-atendimento.json # Workflow: bot WhatsApp com IA (GPT-4o-mini)
│   └── SETUP.md        # Guia passo a passo para configurar tudo no n8n
├── vercel.json         # Config Vercel: outputDirectory=landing
└── CLAUDE.md           # Este arquivo
```

---

## O que já foi feito

### Landing page (concluído)
- [x] Design navy (`#0A1628`) + dourado (`#C9A84C`), fontes Playfair Display + Source Sans 3
- [x] Seções: Hero, Serviços (6), Como Funciona (3 passos), Diferenciais, Depoimentos, FAQ, Contato
- [x] Formulário envia leads via POST para n8n webhook (`/webhook/oliveira-leads`)
- [x] Botão WhatsApp flutuante + CTAs linkam para WhatsApp
- [x] FAQ accordion, scroll animations (IntersectionObserver), responsivo mobile
- [x] Melhorias visuais: sublinhado dourado nos títulos, borda dourada nos cards, estrelas nos depoimentos, setas entre passos, badge "Mais Buscado" no INSS
- [x] vercel.json corrigido para servir CSS externo corretamente

### Banco de dados (schema pronto, mas NÃO aplicado ainda)
- [x] Schema definido em `db/schema.sql`
- [ ] **PENDENTE:** Aplicar o schema no PostgreSQL de produção
- Tabelas: `leads`, `casos`, `conhecimento_juridico`, `sessoes`, `agendamentos`, `pagamentos`
- Extensões: `pgvector`, `uuid-ossp`
- Enums: `status_lead`, `area_juridica`, `tipo_sessao`

### Automação n8n (workflows criados, mas NÃO configurados ainda)
- [x] `01-recepcao-leads.json`: recebe lead do form → salva no DB → WhatsApp por área
- [x] `02-bot-atendimento.json`: bot WhatsApp IA com contexto jurídico especializado
- [ ] **PENDENTE:** Importar workflows no n8n e configurar (ver `n8n/SETUP.md`)
- [ ] **PENDENTE:** Credencial PostgreSQL no n8n
- [ ] **PENDENTE:** Chave OpenAI no nó "HTTP — Chamar OpenAI"
- [ ] **PENDENTE:** Nome da instância Evolution API nos endpoints
- [ ] **PENDENTE:** Webhook da Evolution API apontando para n8n

### Base de conhecimento jurídico (seed — NÃO executado ainda)
- [x] Script `agent/seed-knowledge.js` pronto
- [ ] **PENDENTE:** Criar `.env` em `agent/` com as variáveis abaixo e rodar `npm run seed`
- [ ] **PENDENTE:** Adicionar mais artigos jurídicos ao seed (ver seção abaixo)

### Deploy (concluído)
- [x] Vercel: branch `main` está configurado para deploy automático
- [x] URL esperada: `oliveira-assessoria.vercel.app` (confirmar no painel Vercel)
- [ ] **PENDENTE:** Substituir `55XXXXXXXXXXX` pelo número real do WhatsApp em `landing/index.html`

---

## Variáveis de ambiente necessárias

### `agent/.env` (para rodar o seed)
```env
GEMINI_API_KEY=sua_chave_gemini
PG_HOST=chaoticcow-postgres.cloudfy.live
PG_PORT=8277
PG_USER=postgres
PG_PASSWORD=sua_senha_postgres
PG_DB=db
PG_SSL=true
```

### No n8n (configurar via interface)
- Credencial **Postgres** → nome: `Oliveira DB`
- Chave **OpenAI** → direto no nó "HTTP — Chamar OpenAI"
- **Evolution API Key**: `hucK88FXjn9xwsHJaimmxxvMnZ1Bzwkb`
- **Evolution API URL**: `https://chaoticcow-evolution.cloudfy.live`

---

## Bot de atendimento — Áreas cobertas

O bot (`OLI`) responde automaticamente sobre:

1. **INSS/Previdência** — aposentadoria por idade/tempo, auxílio-doença, BPC/LOAS, salário-maternidade, pensão por morte
2. **Precatórios** — o que é, como verificar no CNJ, RPV, cessão de precatório
3. **Imposto de Renda** — declaração, restituição, malha fina, documentos, prazos
4. **Negociação de Dívidas** — prescrição, direitos do devedor, acordos, CDC

O bot faz perguntas para coletar informações e entrega um **plano de ação numerado**.

---

## O que falta fazer (próximos passos)

### Prioridade Alta
1. Aplicar `db/schema.sql` no PostgreSQL de produção
2. Importar e configurar os 2 workflows no n8n (seguir `n8n/SETUP.md`)
3. Substituir o número WhatsApp placeholder na landing page
4. Testar o fluxo completo: form → DB → WhatsApp → bot

### Prioridade Média
5. Rodar o seed de conhecimento jurídico (`agent/seed-knowledge.js`)
6. Verificar e confirmar URL do Vercel no painel
7. Adicionar mais artigos à base de conhecimento (INSS, IR, Precatório)

### Prioridade Baixa / Futuro
8. RAG vetorial real no bot (atualmente usa busca por keyword; para vetorial real, precisa chamar API de embedding antes da query)
9. Dashboard administrativo para ver leads e sessões
10. Sistema de agendamento usando a tabela `agendamentos`
11. Integração com pagamentos usando a tabela `pagamentos`

---

## Serviços de produção

| Serviço | URL | Notas |
|---|---|---|
| n8n | `chaoticcow-n8n.cloudfy.live` | Admin n8n |
| Evolution API | `chaoticcow-evolution.cloudfy.live/manager` | Gerenciador WhatsApp |
| PostgreSQL | `chaoticcow-postgres.cloudfy.live:8277` | DB principal |
| Vercel | `oliveira-assessoria.vercel.app` | Landing page (confirmar URL) |

---

## Como continuar este projeto (para qualquer IA)

1. Leia este arquivo completo
2. Veja o estado dos arquivos no repositório
3. O item mais urgente é: **aplicar o schema no banco e configurar os workflows no n8n**
4. Consulte `n8n/SETUP.md` para o passo a passo detalhado
5. Não altere o número WhatsApp sem confirmar com o Rodrigo
6. Ao fazer mudanças, atualize a seção "O que já foi feito" e "O que falta fazer" neste arquivo
