# Testes — finalização da Etapa 2

Implementação final verificada no Preview: `5d40796efc9e3934005993a32196f28a109bbbab`. Deployment `dpl_HHNqoPNd6pPYNDBqVTmc8e9aoVrG`, READY, ambiente Preview. Base das alterações: `2f3b9c3`.

**PASS:** 19 páginas × 7 larguras (360, 390, 430, 768, 1024, 1366, 1920), **133 combinações por ambiente**, local e Preview. Zero falhas registradas nas rodadas finais. O último ajuste do título de IR foi incluído na verificação completa do Preview.

| Fluxo/fronteira | Evidência e limite |
| --- | --- |
| Catálogo → ficha | 12 entradas; categorias 8 Itália/4 Brasil; busca normaliza acento/caixa/pontuação; certidões encontra também Organização Documental; combinação de busca e filtro; estado vazio; sem JS |
| Ficha → contato | Nove fichas do padrão documental (oito italianas e Organização Documental) e IR; CTAs preservam opção correta; cabeçalho e fim verificados; seleção por teclado |
| Formulário → requisição | POST e payload originais; campos obrigatórios; todos os pedidos de teste interceptados antes do n8n |
| Resposta → interface | Sucesso simulado, HTTP 500 e falha de rede; mensagem, restauração do botão e preservação/limpeza correta dos campos |
| n8n → serviços externos | Não executado; nenhuma alegação de teste real ponta a ponta |
| Navegação e layout | Menu/Escape/foco, skip link, índice nativo, links/âncoras, imagens, h1/main, ausência de overflow e erros JS |
| Acessibilidade | axe WCAG 2 A/AA e 2.1 A/AA nas 19 páginas em 390 px sem violações; teclado nos fluxos descritos |
| IR local | Rascunho persiste ao recarregar; checklist não envia à equipe; código da ferramenta preservado |
| Status comercial | Matriz: 16 registros, 8 prioridades, 12 pendentes, 4 candidatos, 0 aprovados; candidatos ausentes das ofertas e passaporte brasileiro sem opção no formulário |
| Recursos preservados | Sem alterações em JS de produção, estilos, assets, dependências, vercel.json, n8n, extensão, banco ou agente; listas indicativas e fontes oficiais preservadas nos oito detalhes italianos |

Resultados: [local](evidence/validation-local.json), [Preview](evidence/validation-preview.json), [preservação](evidence/preservation.json). [Capturas](VISUAL.md) e [Lighthouse: 30 execuções](PERFORMANCE.md).

## Ajustes no processo de teste

As primeiras execuções pararam em expectativas do teste: busca de certidões passou a ter dois resultados após detalhar Organização Documental; texto de status é renderizado em maiúsculas pelo CSS; a navegação da nova ficha exigia aguardar a URL antes de ler o formulário. As verificações foram corrigidas para o comportamento esperado, mantendo os cenários antigos. A rodada final completa passou.

A primeira tentativa remota parou por `ERR_CERT_AUTHORITY_INVALID` neste Chromium. A rodada final usou a exceção de CA já prevista no harness; sem alterar TLS no projeto. Não se declara auditoria de certificado. HTTP 200 e noindex foram confirmados separadamente por curl. Nenhum desses ajustes acionou envio real.

## Limites

Sem testes em dispositivos físicos ou Safari/Firefox, auditoria manual completa de acessibilidade, dados de campo/CWV ou validação de todos os cenários fiscais. Sem aprovação jurídica/profissional da operação e sem teste real de WhatsApp, n8n, pagamentos ou contratos. Arquitetura futura é documentação inativa, não funcionalidade testada em produção.
