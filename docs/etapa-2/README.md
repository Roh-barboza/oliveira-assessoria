# Etapa 2 — consolidação do catálogo existente

**Status: iniciada; primeira proposta preparada para revisão operacional.** A autorização de continuidade foi recebida em 17/11/2026 e está [registrada](../decisoes/2026-11-17-whatsapp-e-continuidade.md). Esta entrega documental não altera o site público, não declara catálogo definitivo aprovado e não cria condições comerciais.

## Entregáveis preparados

- [Inventário extraído das páginas atuais](INVENTARIO.json): títulos, listas e opções existentes, sem executar scripts do site.
- [Catálogo proposto estruturado](CATALOGO-PROPOSTO.json): 12 entradas atuais, com preservação dos valores exatos do formulário.
- [Fichas de revisão dos 12 serviços](FICHAS.md): público, apresentação, triagem, limites, fluxo, custos a definir e decisões pendentes.
- [Fontes oficiais consultadas e matriz de revisão](FONTES-E-REVISAO.md).
- [Checklist e decisões para fechar a Etapa 2](APROVACAO.md).

## Organização proposta

| Itália — 8 serviços já existentes | Brasil — 4 serviços da home |
| --- | --- |
| Passaporte italiano | Imposto de Renda |
| AIRE | INSS e benefícios |
| Fast It | Processos administrativos |
| Estado civil | Organização documental |
| Registro de filhos | |
| Certidões italianas | |
| Carta d’identità | |
| Regularização consular | |

As oito páginas consulares e a página de IR já existem. INSS, Processos administrativos e Organização documental ainda direcionam ao contato da home; páginas novas deverão ser preparadas após delimitar o escopo. A proposta não remove serviços nem modifica suas URLs.

## Inconsistências encontradas e encaminhamento

1. **Fast It × AIRE:** tratar claramente a diferença entre suporte ao portal e procedimento cadastral. Preservar os dois nomes existentes até decidir o modelo de oferta; não criar preço duplicado ou prometer canal aplicável a todo serviço.
2. **Estado civil × Registro de filhos:** definir fronteira entre eventos e rota de atendimento familiar. O enquadramento de menores exige revisão técnica por caso e jurisdição; não presumir aquisição automática de cidadania.
3. **Regularização consular:** funcionar como porta de triagem, sem sugerir pacote ilimitado ou que todo procedimento esteja incluído.
4. **Brasil:** confirmar tarefas e órgãos atendidos antes de transformar categorias amplas em ofertas detalhadas.
5. **Legado em `italia.html`:** Negociação de Dívidas, Precatórios e Contratos aparecem nessa página, mas não no formulário e na home atuais. Permanecem registrados e não foram removidos; precisam de confirmação de continuidade e delimitação administrativa.
6. **Preço de IR:** a página atual já mostra “a partir de R$ 149”. Esse valor foi inventariado como legado; não é uma nova aprovação de preço nem foi alterado. Preços/pacotes pertencem à Etapa 3.
7. **Formulário:** “Certidão italiana”, “Outra regularização consular” e “Processo administrativo” são valores internos diferentes dos títulos plurais. Preservá-los evita regressão no payload n8n e na seleção automática.

## Próximas decisões concretas

Duas informações foram solicitadas ao usuário durante esta preparação e seguem sem resposta no momento do registro:

- Consulados/regiões efetivamente atendidos pela Oliveira hoje.
- Continuidade de Negociação de Dívidas, Precatórios e Contratos.

Enquanto isso, a proposta organiza o material existente e explicita o que precisa de validação, sem assumir cobertura operacional nacional/mundial. Depois dessas definições, completar conteúdo das páginas com escopos incluídos/excluídos, requisitos oficiais por jurisdição, etapas, despesas externas e FAQ revisados. Nenhuma condição comercial ausente foi presumida.

## Preservação e validação desta entrega

Alterações somente em documentação; HTML, CSS, JavaScript, recursos visuais, URLs, n8n, Clicksign, banco, contratos e pagamentos permanecem iguais à Etapa 1.1. Por isso não foram repetidos Lighthouse ou testes de interface nesta proposta. Eventuais Previews automáticos da integração Git continuam servindo o mesmo código público; o Preview visual avaliado favoravelmente pelo usuário permanece na entrega anterior.

Verificações desta etapa: JSON válido; inventário confrontado com 8 páginas consulares, 4 opções brasileiras e 3 categorias legadas; existência dos caminhos locais; correspondência exata das 12 opções com o formulário. Fontes oficiais iniciais consultadas em 17/11/2026, com limitações e necessidade de revisão registradas. Não há medição de performance nova nesta entrega documental.

## WhatsApp

Preferência salva: botão com ícone de WhatsApp e link para número empresarial quando informado. Número ainda indisponível; contato atual permanece por formulário. Não usar ícone enganoso ou número fictício. Ver [decisão persistente](../decisoes/2026-11-17-whatsapp-e-continuidade.md).

## Limites da autorização

O usuário autorizou avançar; isso permite iniciar esta etapa sem repetir o pedido de aprovação visual. Não implica aprovação individual de Jennifer, merge ou produção. Esta proposta não aprova automaticamente preços, contratação Clicksign, cobranças ou envio real ao n8n/WhatsApp. A Etapa 3 depende de catálogo e escopos definidos; integrações e publicação continuam nos marcos próprios do projeto.
