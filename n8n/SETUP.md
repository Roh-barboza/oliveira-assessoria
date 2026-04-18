# Setup — Oliveira Assessoria n8n + Banco de Dados

Siga os passos abaixo em ordem. Tempo estimado: **15–20 minutos**.

---

## 1. Aplicar o schema no PostgreSQL

Acesse o banco e rode o arquivo `db/schema.sql`.

**Via qualquer cliente SQL (DBeaver, TablePlus, pgAdmin):**

```
Host:     SEU_HOST_POSTGRES
Porta:    SUA_PORTA
Usuário:  postgres
Senha:    SUA_SENHA
Database: db
SSL:      Necessário (modo "requer" ou "prefer")
```

Abra `db/schema.sql` e execute. Se já rodou antes, os `CREATE TABLE IF NOT EXISTS` são seguros.

**Ou via psql na sua máquina:**
```bash
PGPASSWORD="SUA_SENHA" psql \
  -h SEU_HOST_POSTGRES \
  -p SUA_PORTA -U postgres -d db \
  -f db/schema.sql
```

---

## 2. Criar Credencial PostgreSQL no n8n

1. Acesse **https://chaoticcow-n8n.cloudfy.live**
2. Vá em **Settings → Credentials → + Add credential**
3. Selecione **Postgres**
4. Preencha:

| Campo | Valor |
|---|---|
| Name | `Oliveira DB` |
| Host | `SEU_HOST_POSTGRES` |
| Port | `SUA_PORTA` |
| Database | `db` |
| User | `postgres` |
| Password | `SUA_SENHA` |
| SSL | Ativado |

5. Clique em **Save** e **Test** — deve aparecer "Connection tested successfully"

---

## 3. Verificar nome da instância Evolution API

1. Acesse **https://chaoticcow-evolution.cloudfy.live/manager**
2. Anote exatamente o **nome da instância** (ex: `oliveira`, `principal`, `atendimento`)

Você vai precisar desse nome no passo 5 e 7.

---

## 4. Criar Credencial SMTP (Gmail) no n8n

**Para receber relatórios de leads por email:**

1. Acesse **https://myaccount.google.com/security** com a conta `oliveira.assessoria.juridica26@gmail.com`
2. Ative **Verificação em duas etapas** (obrigatória para senhas de app)
3. Procure **Senhas de app** → selecione "Outro" → escreva `n8n` → clique em **Gerar**
4. Copie a senha de 16 caracteres gerada

5. No n8n, vá em **Settings → Credentials → + Add credential**
6. Selecione **SMTP**
7. Preencha:

| Campo | Valor |
|---|---|
| Name | `Gmail Oliveira` |
| Host | `smtp.gmail.com` |
| Port | `587` |
| User | `oliveira.assessoria.juridica26@gmail.com` |
| Password | (senha de app de 16 caracteres) |
| SSL/TLS | STARTTLS |

8. Clique em **Save** e **Test**

---

## 5. Obter chave da OpenAI

1. Acesse **https://platform.openai.com/api-keys**
2. Crie uma nova chave (ou use uma existente)
3. Copie — você vai precisar no passo 6

> Custo estimado: ~$0.02 por lead analisado com GPT-4o-mini (análise + boas-vindas)

---

## 6. Importar Workflow 1 — Recepção de Leads

**Este workflow: recebe o formulário → salva no banco → envia boas-vindas no WhatsApp → analisa o caso com IA → envia relatório por email.**

1. No n8n, clique em **+ New Workflow → Import from file**
2. Selecione o arquivo: `n8n/01-recepcao-leads.json`
3. Configure o nó **"Postgres — Upsert Lead"**:
   - Em **Credentials**, selecione **"Oliveira DB"**
4. Configure o nó **"HTTP — Enviar Boas-vindas WhatsApp"**:
   - Substitua `NOME_DA_INSTANCIA` pelo nome real (passo 3)
   - Substitua `SUA_EVOLUTION_APIKEY` pela chave da Evolution API
5. Configure o nó **"HTTP — OpenAI Análise Lead"**:
   - Substitua `SUA_OPENAI_KEY_AQUI` pela sua chave da OpenAI
6. Configure o nó **"Email — Relatório para Jennifer"**:
   - Em **Credentials**, selecione **"Gmail Oliveira"**
7. Clique em **Save**
8. Clique no toggle **Activate** → workflow fica verde

**O que você vai receber no email a cada novo lead:**
- Dados do cliente (nome, WhatsApp, área)
- Mensagem que ele escreveu
- Análise de elegibilidade gerada por IA
- Documentos necessários
- Passo a passo para resolver o caso
- Prazo estimado e valor sugerido
- Pontos de atenção

---

## 7. Importar Workflow 2 — Bot WhatsApp com IA

**Este é o bot inteligente de atendimento.**

1. No n8n, clique em **+ New Workflow → Import from file**
2. Selecione: `n8n/02-bot-atendimento.json`
3. Após importar, configure os **três nós Postgres** (Upsert Lead, Sessão, Buscar Conhecimento):
   - Em cada um: **Credentials → Oliveira DB**
4. Clique no nó **"HTTP — Chamar OpenAI"**
   - Substitua `SUA_OPENAI_KEY_AQUI` pela sua chave da OpenAI
5. Clique no nó **"HTTP — Enviar Resposta WhatsApp"**
   - Substitua `NOME_DA_INSTANCIA` pelo nome real da instância
6. Clique em **Save**
7. Clique em **Activate**
8. **Copie a URL do webhook** que aparece no nó "Webhook — Entrada WhatsApp":
   ```
   https://chaoticcow-n8n.cloudfy.live/webhook/oliveira-whatsapp
   ```

---

## 8. Configurar Webhook no Evolution API

**Para o bot receber as mensagens do WhatsApp:**

1. Acesse **https://chaoticcow-evolution.cloudfy.live/manager**
2. Selecione sua instância
3. Vá em **Webhooks** (ou "Configurações da instância")
4. Adicione:
   - **URL:** `https://chaoticcow-n8n.cloudfy.live/webhook/oliveira-whatsapp`
   - **Eventos:** `messages.upsert` (ou "Messages" se for seleção por tipo)
5. Salve

**Alternativamente via API (mais rápido):**
```bash
curl -X POST https://chaoticcow-evolution.cloudfy.live/webhook/set/NOME_DA_INSTANCIA \
  -H "apikey: hucK88FXjn9xwsHJaimmxxvMnZ1Bzwkb" \
  -H "Content-Type: application/json" \
  -d '{
    "webhook": {
      "enabled": true,
      "url": "https://chaoticcow-n8n.cloudfy.live/webhook/oliveira-whatsapp",
      "events": ["MESSAGES_UPSERT"]
    }
  }'
```

---

## 9. Testar tudo

**Teste 1 — Formulário da landing page:**
1. Abra a landing page
2. Preencha e envie o formulário
3. Verifique no n8n (Workflow 1 → Executions) se executou com sucesso
4. Você deve receber uma mensagem de boas-vindas no WhatsApp do cliente
5. Você deve receber um email em `oliveira.assessoria.juridica26@gmail.com` com o relatório completo do lead

**Teste 2 — Bot WhatsApp:**
1. Envie uma mensagem para o número do WhatsApp conectado na instância
2. Tente: "Preciso de ajuda com meu INSS"
3. O bot OLI deve responder em segundos

**Debug se algo falhar:**
- n8n: vá em **Executions** do workflow com problema → clique na execução → veja o nó vermelho
- Se der erro de DB: reconfirme as credenciais e se o schema foi aplicado
- Se der erro de Evolution: verifique o nome da instância e se ela está conectada

---

## 10. Próximos passos opcionais

- **Seed do banco de conhecimento:** rode `npm run seed` na pasta `agent/` após configurar o `.env` com a GEMINI_API_KEY e as credenciais do banco
- **Número de WhatsApp da landing:** substitua `55XXXXXXXXXXX` nos links da landing page pelo número real
- **RAG vetorial real:** depois do seed, atualize a query do nó "Postgres — Buscar Conhecimento" para usar busca por embedding (`ORDER BY embedding <=> $1::vector LIMIT 3`)
