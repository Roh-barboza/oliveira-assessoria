# Fluxo de Análise de Documentos — 7 Fases

> Especificação técnica do fluxo de processamento de documentos enviados por clientes.

---

## Visão geral

O cliente envia documentos (PDF, imagens de laudos, CTPS, carnês INSS, etc.) via WhatsApp ou formulário. O sistema processa automaticamente em 7 fases e entrega uma análise estruturada.

---

## Fase 1 — Recepção

**Gatilho:** Mensagem com anexo no WhatsApp (Evolution API) ou upload no formulário da landing page.

**Ações:**
- Registrar recebimento no banco (`casos` table)
- Identificar tipo de arquivo (PDF, JPG, PNG, DOCX)
- Armazenar no storage (bucket S3 ou similar)
- Confirmar recebimento para o cliente: "Recebi seu documento! Vou analisar e te retorno em breve."

**Dados capturados:**
```
lead_id, nome_arquivo, tipo_mime, tamanho_bytes, url_storage, timestamp_recebimento, area_juridica
```

---

## Fase 2 — Validação

**Ações:**
- Verificar se o arquivo é legível (não corrompido)
- Verificar tamanho (máximo 10MB por arquivo)
- OCR básico: verificar se há texto extraível (documentos escaneados vs. PDFs nativos)
- Detectar tipo de documento: laudo médico, CTPS, RG/CPF, holerite, declaração IR, contrato, etc.

**Saída:** `{ valido: true/false, tipo_documento: "laudo_medico", tem_texto: true, qualidade: "boa/ruim" }`

**Se inválido:** Notificar cliente e pedir reenvio com orientação ("o arquivo está ilegível, por favor envie uma foto melhor ou escaneie em boa resolução").

---

## Fase 3 — Processamento (OCR + Extração)

**Ações:**
- OCR completo do documento (Google Vision API ou similar)
- Extração de entidades-chave:
  - Datas (data do exame, data de emissão, validade)
  - CIDs (ex: M17.1, G35, etc.)
  - Nomes de médicos e CRMs
  - Valores (salários, dívidas, valores de restituição)
  - CPF do paciente/cliente
  - Nome do hospital/laboratório/órgão emissor

**Saída estruturada:**
```json
{
  "texto_completo": "...",
  "entidades": {
    "datas": ["2024-03-15"],
    "cids": ["M17.1"],
    "medico": "Dr. João Silva",
    "crm": "CRM-SP 123456",
    "instituicao": "Hospital São Lucas"
  }
}
```

---

## Fase 4 — Armazenamento + PGVector

**Ações:**
- Salvar texto extraído na tabela `conhecimento_juridico` (ou nova tabela `documentos_cliente`)
- Gerar embedding via Google Gemini (`text-embedding-004`) do conteúdo do documento
- Salvar embedding no campo `embedding vector(768)`
- Indexar para busca semântica futura (encontrar documentos similares, cruzar com base de conhecimento)

**Query de inserção:**
```sql
INSERT INTO documentos_cliente 
  (lead_id, tipo_documento, texto_extraido, entidades_json, embedding, url_storage)
VALUES ($1, $2, $3, $4, $5::vector, $6);
```

---

## Fase 5 — Análise com IA

**Modelo:** OpenAI GPT-4o (não mini — para análise de documentos usar modelo mais poderoso)

**Contexto enviado:**
1. Texto extraído do documento
2. Dados do cliente (área de interesse, situação relatada no formulário)
3. Artigos relevantes da base de conhecimento (via busca vetorial PGVector)
4. Prompt especializado por tipo de documento

**Prompts por tipo:**

*Para laudo médico (INSS):*
```
Analise este laudo médico considerando os critérios do INSS para concessão de benefícios.
Identifique: (1) qual benefício parece elegível, (2) pontos fortes do laudo para aprovação,
(3) pontos fracos ou informações faltantes, (4) documentos complementares recomendados,
(5) probabilidade estimada de aprovação (alta/média/baixa) com justificativa.
```

*Para declaração de IR:*
```
Analise esta documentação de Imposto de Renda. Identifique: (1) se há pendências ou
inconsistências, (2) deduções não aproveitadas, (3) risco de malha fina, (4) valor estimado
de restituição ou imposto a pagar, (5) recomendações para o cliente.
```

*Para contrato:*
```
Analise este contrato. Identifique: (1) cláusulas abusivas ou ilegais, (2) obrigações do
cliente e riscos, (3) prazos importantes, (4) multas e penalidades, (5) recomendações.
```

**Saída da IA:**
```json
{
  "resumo": "Laudo de gonartrose grau III — elegível para auxílio por incapacidade temporária",
  "elegibilidade": "alta",
  "pontos_fortes": ["CID M17.1 presente", "Laudo descreve limitação funcional"],
  "pontos_fracos": ["Falta goniometria (arco de movimento)", "Sem relatório de fisioterapia"],
  "documentos_faltantes": ["Goniometria", "Laudos de tratamentos anteriores"],
  "plano_acao": ["1. Solicitar goniometria ao ortopedista", "2. Reunir recibos de fisioterapia", "3. Protocolar requerimento no INSS"],
  "probabilidade": "alta",
  "observacoes": "..."
}
```

---

## Fase 6 — Revisão da Jennifer

**Interface:** Dashboard administrativo (a construir) ou n8n + notificação WhatsApp para Jennifer.

**Notificação automática para Jennifer:**
```
Novo documento analisado:
Cliente: Maria Silva
Tipo: Laudo médico (INSS)
IA avaliou: Elegibilidade ALTA para auxílio-doença
Pontos fracos: falta goniometria

➡️ Aprovar análise, editar ou pedir mais documentos?
[Aprovar] [Editar] [Solicitar docs]
```

**Opções:**
- Aprovar: análise vai direto para o cliente
- Editar: Jennifer ajusta antes de enviar
- Solicitar docs: bot pede documentos adicionais ao cliente

---

## Fase 7 — Resposta ao Cliente

**Canal:** WhatsApp (Evolution API) via n8n

**Formato da mensagem ao cliente:**
```
Olá, Maria! Analisei seu laudo com atenção. Aqui está o resultado:

📋 *ANÁLISE DO SEU LAUDO*

✅ *Situação:* Seu caso tem ALTA probabilidade de aprovação no INSS para auxílio-doença.

💪 *Pontos fortes do seu laudo:*
• CID M17.1 (Gonartrose primária bilateral) presente
• Médico descreveu limitação de movimento

⚠️ *O que ainda precisamos:*
• Goniometria (medição do arco de movimento) — peça ao seu ortopedista
• Recibos de fisioterapia dos últimos 6 meses

📌 *Próximos passos:*
1. Consiga a goniometria com seu ortopedista (explique que é para o INSS)
2. Reúna os recibos de fisioterapia
3. Me manda esses documentos e eu protocolo tudo no INSS para você

Qualquer dúvida, pode perguntar! Estou aqui. 😊
```

---

## Tabelas necessárias no banco (futuras)

```sql
CREATE TABLE documentos_cliente (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID REFERENCES leads(id),
  tipo_documento VARCHAR(100),
  nome_arquivo VARCHAR(255),
  url_storage TEXT,
  texto_extraido TEXT,
  entidades_json JSONB,
  analise_ia_json JSONB,
  status VARCHAR(50) DEFAULT 'pendente', -- pendente, aprovado, editado, enviado
  embedding vector(768),
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX ON documentos_cliente USING hnsw (embedding vector_cosine_ops);
```

---

## Stack técnica necessária

| Componente | Tecnologia |
|---|---|
| OCR | Google Cloud Vision API ou Tesseract (self-hosted) |
| Embeddings | Google Gemini `text-embedding-004` |
| Análise IA | OpenAI GPT-4o |
| Storage | Cloudflare R2 ou AWS S3 |
| Orquestração | n8n (novo workflow `03-analise-documentos.json`) |
| Notificação Jennifer | WhatsApp via Evolution API |
| Interface revisão | Dashboard simples (fase futura) |

---

## Status de implementação

- [ ] Tabela `documentos_cliente` no schema
- [ ] Workflow n8n `03-analise-documentos.json`
- [ ] Integração OCR
- [ ] Prompt templates por tipo de documento
- [ ] Notificação WhatsApp para Jennifer
- [ ] Interface de revisão da Jennifer
- [ ] Resposta automática ao cliente
