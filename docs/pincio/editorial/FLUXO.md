# Conteúdos Pincio

## Estado desta entrega

A página pública `/conteudos.html` e os links de navegação estão implementados. Ela permanece sem artigos publicados enquanto o fluxo de pesquisa, revisão e armazenamento não for conectado. O site atual é estático, publicado pela Vercel a partir de `landing/`.

## Fluxo editorial planejado

1. Registrar a pauta, público, categoria e palavras-chave.
2. Pesquisar fontes oficiais e primárias. Guardar título da fonte, URL, órgão responsável, data de publicação e data de consulta.
3. Redigir em português brasileiro, com linguagem clara e institucional da Pincio. Diferenciar fatos oficiais de orientações editoriais. Não completar lacunas com suposições.
4. Validar URLs e identificar divergências entre fontes. Conteúdo jurídico, consular, migratório, fiscal ou de saúde deve permanecer como rascunho até revisão humana.
5. Guardar o artigo como rascunho estruturado. A equipe revisa, edita e aprova a versão.
6. Após aprovação, gerar a página do artigo, inserir no índice público e no sitemap e publicar uma nova versão do site.

## Integrações necessárias para o agente publicar

- Provedor de IA com ferramenta de pesquisa web e credencial privada no servidor.
- Repositório de conteúdo estruturado e trilha de revisões.
- Autenticação de editores e papéis de autor, revisor e publicador.
- Endpoint de publicação que aceite apenas artigos aprovados, valide o conteúdo e o salve em rascunho ou publicação.
- Processo de build/deploy da Vercel para gerar páginas individuais, metadados de compartilhamento e sitemap.
- Regra de retenção de fontes e registro de quem aprovou cada versão.

Nenhuma credencial deve entrar no navegador, no repositório ou no artigo publicado. Não habilitar publicação direta pelo modelo. O estado inicial do sistema é sempre rascunho.

## Formato de artigo

```json
{
  "slug": "exemplo-de-artigo",
  "title": "Título informativo",
  "summary": "Resumo curto e específico",
  "category": "Serviços consulares",
  "author": "Equipe Pincio",
  "publishedAt": null,
  "updatedAt": null,
  "status": "draft",
  "body": [
    { "type": "paragraph", "text": "Introdução" },
    { "type": "heading", "level": 2, "text": "Seção" },
    { "type": "paragraph", "text": "Desenvolvimento" },
    { "type": "list", "items": ["Etapa um", "Etapa dois"] }
  ],
  "sources": [
    {
      "title": "Fonte oficial",
      "url": "https://example.gov/",
      "publisher": "Órgão responsável",
      "publishedAt": null,
      "accessedAt": "AAAA-MM-DD"
    }
  ],
  "review": {
    "reviewer": null,
    "approvedAt": null,
    "notes": ""
  }
}
```

## Prompt editorial base

Você é o agente editorial da Pincio Assessoria Internacional. Pesquise a pauta usando fontes primárias e oficiais sempre que disponíveis. Escreva para brasileiros que precisam entender procedimentos documentais, consulares e administrativos entre Brasil e Itália. Use português brasileiro, tom profissional e didático, frases claras e exemplos apenas quando confirmados pelas fontes. Nunca invente requisitos, prazos, custos, garantias ou decisões. Aponte quando a regra varia por consulado, município ou situação individual. Inclua links diretos das fontes, órgão responsável e data de consulta. Registre divergências e pontos que exigem validação. Entregue o artigo no formato estruturado definido neste documento com status draft. Não marque como aprovado nem publique.
