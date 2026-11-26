# PINCIO Assessoria Internacional — Pendências para executar com Codex
Data de preparação: 25/11/2026

## Estado já implementado no repositório
- Projeto Vercel: ID prj_M19hHqI7fq25KgKnXWIqUYRXmxhq (slug técnico herdado oliveira-assessoria).
- Repositório: Roh-barboza/oliveira-assessoria.
- Branch da nova marca: release/pincio-identidade-2026-11-25.
- Domínio provisório verificado: https://pincio-assessoria.vercel.app/.
- Site público, páginas de serviços, formulário, painel de demonstração, cabeçalhos, rodapés, meta tags, sitemap, SVGs, PDF sintético e nome de anexos atualizados para PINCIO.
- Mantidos como identificadores técnicos legados, sem migração destrutiva: tabelas SQL oliveira_*, cookies oliveira-*, variáveis OLIVEIRA_*, rotas de API, webhook /webhook/oliveira-leads e referências internas do repositório.
- Importante: a área operacional real permanece restrita à Preview; o simulador público é somente sintético, com estado volátil por instância.

## Objetivo e regras
Concluir a migração comercial e tecnológica para PINCIO Assessoria Internacional sem expor dados pessoais, alterar contratos reais ou quebrar autenticação, backups e serviços existentes. Não alegar disponibilidade de domínio, deferimento de marca, integração de produção ou funcionamento de pagamentos sem evidência verificável. Preservar permissões e bloqueios existentes, sobretudo MFA, domínio de origem, controle de acesso e segregação Preview/Produção.

### 1. Domínio e marca (dependem de ação/validação do titular)
- Confirmar diretamente no Registro.br o domínio pincioassessoria.com.br. Consulta preliminar de terceiros não é garantia de disponibilidade, não compra nem reserva.
- Fazer pesquisa completa na base oficial do INPI por PINCIO e grafias semelhantes, classes aplicáveis. Encaminhar para avaliação profissional, quando necessário. Não afirmar exclusividade jurídica sem validação.
- Somente após autorização e registro do domínio: configurar DNS, domínio apex e www no projeto Vercel existente, HTTPS, redirects 301 de hosts antigos, canonicals, sitemap e contatos, mantendo rollback.
- Não alterar o domínio provisório antes da verificação DNS ou comprar serviços em nome do usuário.

### 2. Identidade visual e fotografia
- Conferir a aparência dos três SVGs PINCIO no desktop, mobile, header claro e rodapé escuro. Preservar legibilidade e contraste.
- Usuária deseja atmosfera genuinamente italiana: obter fotografia REAL, com licença verificável, da Terrazza del Pincio e vista de Roma. Guardar licença/autoria e créditos. Nunca apresentar montagem gerada por IA como fotografia documental real.
- Entregar imagens locais otimizadas WebP/AVIF com srcset, largura, altura, loading e alt adequados; usar fotografia na página inicial / hero, mantendo o logo preferencialmente vetorial para reprodução.
- Gerar variações de marca sem fundo, ícone pequeno e versões monocromáticas, sem compartilhar arquivos de fonte.

### 3. Formulários, comunicação e LGPD
- O webhook atual de leads usa /webhook/oliveira-leads num n8n externo. NÃO trocar o endpoint sem provisionar o novo e validar o contrato de payload/cors no domínio PINCIO. Checar submissão real consentida, recebimento confirmado, deduplicação, antifraude, logs sem PII e política LGPD.
- Revisar razão social/CNPJ e controlador do tratamento de dados na Política de Privacidade e Termos. O rebranding visual não altera automaticamente a pessoa jurídica. Não inventar número de registro.
- Atualizar e-mails institucionais somente após configurar e comprovar posse de domínio, SPF/DKIM/DMARC, caixas postais e encaminhamento.
- Revisar templates de e-mail, notificações e arquivos gerados em backend para evitar marca antiga visível.

### 4. Plataforma real e integrações
- Manter as APIs reais protegidas, restritas à Preview, até completar homologação. Não publicar dashboard real sem autenticação, MFA, RBAC, armazenamento seguro, migrações, antivírus documental e backups testados.
- Resolver Clicksign 401 por token válido obtido e configurado PELO USUÁRIO diretamente nos secrets, nunca no chat/repositório. Testar o fluxo autorizado no Sandbox antes de Production.
- Avaliar persistência isolada para o simulador público se o usuário quiser sessões estáveis, nunca usando bancos/arquivos reais de produção.
- Rever identidade da assinatura em minutas, Clicksign e contratos legais somente depois de confirmação jurídica e autorização.

### 5. Migração técnica final
- Se desejar renomear o projeto/repositório GitHub ou migrar o legado oliveira-* de cookies/DB/secrets, elaborar plano com inventário de dependências, backup testado, compatibilidade dupla, rollback e janela de migração. Nunca renomear tabelas, cookies, origin allowlists ou variáveis de uma vez.
- Preservar URL pública e serviço: https://pincio-assessoria.vercel.app/; evitar quebrar os links antigos até configurar redirects.
- Conferir todos os links internos, formulários, acessibilidade, responsividade 360–1920px, SEO, cabeçalhos, sitemap, PDFs e carregamento real.

### 6. Catálogo aprovado, não reintroduzir serviços removidos
- Passaporte italiano: assessoria de agendamento APENAS para renovação; primeira emissão: somente suporte documental.
- Manter AIRE, FAST IT, estado civil conforme escopos atuais.
- Montagem de pasta para processos de cidadania italiana é serviço DOCUMENTAL, não organização documental genérica.
- NÃO ofertar registro de filhos, emissão de certidões italianas, carta d'identità, INSS e benefícios nem organização documental genérica.
- Não prometer agendamento garantido, aprovação, resultado judicial, taxas ou prazos de órgãos.

## Critérios de aceite
- npm ci; npm test; npm run test:platform; npm run test:operational-ui; node --test tests/platform-public-demo-release.test.mjs tests/pincio-brand.test.mjs; npm audit --omit=dev.
- GitHub Actions verde, deployment Vercel READY, domínio final verificado e HTTPS válido.
- Homologação manual documentada dos fluxos comerciais e de login; provas de origem de fotos e de titularidade de domínios; nenhuma senha/token/PII em logs ou repositório.
- Resultado final: PRs com diffs objetivos, testes e checklist de pendências que exigem ação humana. Não concluir itens sem comprová-los.
