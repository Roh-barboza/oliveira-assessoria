# Oliveira Assessoria Jurídica — Contexto do Projeto

> Este arquivo é a memória do projeto. Qualquer IA ou desenvolvedor que continuar o trabalho deve ler este arquivo primeiro.

---

## O que é o projeto

Escritório de **consultoria jurídica digital** (não advocacia) para pessoas físicas. Jennifer tem formação em Direito mas ainda **não tem OAB** — então o modelo é assessoria/consultoria, não representação em juízo.

**Áreas de atuação (sem OAB):**
- INSS e Previdência Social (aposentadoria, auxílio-doença, BPC/LOAS)
- Imposto de Renda (declaração, restituição, malha fina)
- FGTS (saque, complementação)
- Negociação de dívidas
- Consultoria jurídica (pareceres, análise de contratos, compliance)

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
│   ├── index.html      # Site principal
│   ├── style.css       # Estilos (externo)
│   └── script.js       # (vazio — JS está inline no index.html)
├── agent/
│   ├── package.json
│   └── seed-knowledge.js  # Popula banco com artigos jurídicos + embeddings Gemini
├── db/
│   └── schema.sql      # Schema PostgreSQL (aplicar 1x no banco de produção)
├── n8n/
│   ├── 01-recepcao-leads.json   # Form landing → WhatsApp boas-vindas
│   ├── 02-bot-atendimento.json  # Bot WhatsApp IA (GPT-4o-mini)
│   └── SETUP.md                 # Guia passo a passo para configurar n8n
├── docs/
│   ├── inss-jennifer-atuacao.md   # Guia INSS + o que Jennifer pode fazer sem OAB
│   ├── fluxo-analise-documentos.md # Fluxo 7 fases de análise de docs
│   └── modelo-negocio.md           # Estrutura do escritório + projeções
├── vercel.json         # outputDirectory=landing
└── CLAUDE.md           # Este arquivo
```

---

## O que Jennifer pode fazer SEM OAB

Jennifer tem **formação em Direito** mas ainda não tem OAB. Ela pode:

✅ **Pode:**
- Consultoria jurídica (parecer, análise, orientação)
- Gestão de processos administrativos no INSS
- Acompanhamento de perícias médicas
- Análise de documentos e elegibilidade
- Elaborar requerimentos administrativos (não judiciais)
- Calcular salário-benefício, tempo de contribuição
- Cursos e treinamentos jurídicos
- Due diligence, compliance, LGPD
- Interpor recursos administrativos (INSS, Receita Federal)

❌ **Não pode:**
- Representar cliente em juízo (precisa de OAB)
- Assinar como "advogada"
- Interpor recursos judiciais

---

## Patologias que aposentam pelo INSS

### Aposentadoria por Invalidez / BPC-LOAS
Qualquer doença incapacitante permanente. Exemplos comuns que o escritório atende:

**Problemas no joelho:**
- Artrose severa (graus III e IV)
- Lesão grave de ligamentos (LCA, LCP)
- Gonartrose bilateral
- Osteonecroses
- Necessidade de prótese total

**Problemas no ombro:**
- Síndrome do manguito rotador (ruptura total)
- Artrose glenoumeral severa
- Frozen shoulder (ombro congelado)
- Lesão de SLAP grave
- Artrite reumatoide articular

**Outras doenças que aposentam:**
- Neoplasias (cânceres)
- Doenças cardíacas graves
- Problemas na coluna (hérnia, estenose)
- Diabetes com complicações
- Distúrbios psiquiátricos graves
- HIV/AIDS
- Doenças raras (lista CONITEC)

### Auxílio por Incapacidade Temporária (antigo Auxílio-Doença)
Incapacidade temporária (não permanente). Válido para joelho/ombro em recuperação pós-cirúrgica ou aguardando cirurgia.

---

## Fluxo de análise de documentos (7 fases)

**Planejado na conversa anterior — ainda NÃO implementado:**

```
FASE 1: Recebimento
→ Cliente envia docs via WhatsApp (Evolution API)
→ n8n captura e categoriza

FASE 2: Validação
→ Verifica completude dos documentos
→ Lista o que está faltando
→ Notifica cliente

FASE 3: Processamento
→ OCR nos documentos (se necessário)
→ Extração de dados estruturados

FASE 4: Armazenamento
→ PostgreSQL + PGVector
→ Embeddings via Gemini para busca semântica

FASE 5: Análise IA
→ GPT-4o-mini analisa elegibilidade
→ Compara com base de conhecimento jurídico
→ Gera parecer preliminar 80% pronto

FASE 6: Análise Jennifer
→ Jennifer revisa o parecer gerado pela IA
→ Ajusta e assina consultoria
→ Define próximos passos

FASE 7: Resposta ao Cliente
→ Envia plano de ação personalizado via WhatsApp
→ Agenda próximos passos
→ Registra no banco
```

---

## Serviços e precificação planejada

| Serviço | Preço | Observação |
|---|---|---|
| Consulta inicial | Grátis | Qualificação do lead |
| Gestão INSS (acompanhamento) | R$300–800 | Por cliente |
| Consultoria jurídica (parecer) | R$500–2.000 | Por parecer |
| Declaração IR | R$149+ | Conforme complexidade |
| Negociação de dívidas | Grátis + sucesso | % do desconto obtido |
| Curso/Treinamento | R$2.000–10.000 | Por turma |

---

## O que já foi feito

### Landing page (concluído)
- [x] Design navy (`#0A1628`) + dourado (`#C9A84C`)
- [x] Seções: Hero, Serviços, Como Funciona, Diferenciais, Depoimentos, FAQ, Contato
- [x] Formulário envia leads via POST para n8n
- [x] Botão WhatsApp flutuante + CTAs
- [x] Melhorias visuais completas
- [x] Responsivo mobile
- [x] Deploy no Vercel (branch main)
- [x] vercel.json corrigido (outputDirectory=landing)

### Banco de dados
- [x] Schema definido em `db/schema.sql`
- [ ] **PENDENTE:** Aplicar schema no PostgreSQL de produção

### Automação n8n
- [x] `01-recepcao-leads.json` — lead do form → salva DB → WhatsApp boas-vindas
- [x] `02-bot-atendimento.json` — bot WhatsApp IA especializado
- [ ] **PENDENTE:** Importar e configurar no n8n (ver `n8n/SETUP.md`)
- [ ] **PENDENTE:** Credencial PostgreSQL no n8n
- [ ] **PENDENTE:** OpenAI key + nome da instância Evolution API
- [ ] **PENDENTE:** Webhook Evolution API → n8n

### Base de conhecimento jurídico
- [x] Script `agent/seed-knowledge.js` pronto
- [ ] **PENDENTE:** Rodar seed após configurar `.env`

### Fluxo de análise de documentos (PLANEJADO, não implementado)
- [ ] **PENDENTE:** n8n workflow de 7 fases (ver docs/fluxo-analise-documentos.md)
- [ ] **PENDENTE:** Schema para tabelas: clients, cases, documents, analysis
- [ ] **PENDENTE:** Integração OCR + PGVector para documentos médicos/previdenciários

---

## O que falta fazer — Prioridade

### Alta (implementar agora)
1. Aplicar `db/schema.sql` no PostgreSQL
2. Configurar workflows no n8n (`n8n/SETUP.md`)
3. Substituir número WhatsApp placeholder (`55XXXXXXXXXXX`) na landing
4. Testar fluxo completo: form → DB → WhatsApp → bot

### Média
5. Rodar seed de conhecimento jurídico
6. Implementar fluxo de análise de documentos (7 fases)
7. Confirmar URL do Vercel no painel

### Baixa / Futuro
8. RAG vetorial real (embedding antes da query pgvector)
9. Dashboard administrativo
10. Sistema de agendamento
11. Integração com pagamentos

---

## Perguntas em aberto (respondidas por Rodrigo definem próximos passos)

Da conversa anterior, estas 4 perguntas ficaram sem resposta:

1. **Especialidade principal:** INSS? Trabalhista? Imobiliário? Múltiplas áreas?
2. **Dedicação:** 20h/semana (side project) ou 40h/semana (full-time)?
3. **Estrutura:** Só Jennifer? Com parceiro advogado? Com Rodrigo também?
4. **Crescimento:** Conservador (5–10 clientes/mês) ou agressivo (30–50/mês)?

---

## Serviços de produção

| Serviço | URL |
|---|---|
| n8n | `chaoticcow-n8n.cloudfy.live` |
| Evolution API | `chaoticcow-evolution.cloudfy.live/manager` |
| PostgreSQL | `chaoticcow-postgres.cloudfy.live:8277` |
| Vercel | `oliveira-assessoria.vercel.app` |

---

## Como continuar este projeto (para qualquer IA)

1. Leia este arquivo completo
2. Veja o estado dos arquivos no repositório
3. O mais urgente: **aplicar schema no banco + configurar n8n** (`n8n/SETUP.md`)
4. As 4 perguntas em aberto acima definem os próximos desenvolvimentos
5. Não altere o número WhatsApp sem confirmar com o Rodrigo
6. Ao fazer mudanças, atualize "O que já foi feito" e "O que falta fazer"
