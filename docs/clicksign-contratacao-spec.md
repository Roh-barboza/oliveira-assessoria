# Contratação digital — implementação de teste

A implementação atual está em `server/platform/app.mjs`, `server/platform/pdf.mjs` e `server/platform/providers/clicksign.mjs`. O painel usa **somente o simulador interno**. Não cria envelopes reais, envia e-mails ou ativa contratação.

## Reaproveitamento e histórico

Foram examinados os PRs #1 (`feature/clicksign-contratacao-prototipo`, `f4b7625`) e #2 (`feature/contratacao-digital-sandbox`, `1372f8a`). Foram reaproveitados os auxiliares AES-GCM/scrypt/HMAC, a renderização de PDF e a estrutura do adaptador da API v3 de sandbox. Não foram incorporados os preços ilustrativos, a interface antiga, o banco anterior ou a autenticação anterior. O histórico original continua nesses PRs; seus números não são preços aprovados.

## Fluxo executável

1. Usuário autenticado abre um caso do próprio espaço de teste.
2. Gera minuta PDF com escopo específico da modalidade, limites, vigência privada e valor **pendente**. Dados exclusivamente sintéticos.
3. O servidor preserva versão, hash SHA-256 e PDF cifrado no estado privado.
4. Convite interno idempotente altera o estado para aguardando assinatura simulada, sem transporte externo.
5. Somente o cliente proprietário pode simular a assinatura. Cancelamento/falha e histórico também estão disponíveis; assinatura concluída é terminal.
6. Download autenticado do PDF original. O simulador **não produz assinatura eletrônica válida ou comprovante Clicksign**.

O webhook de teste valida HMAC, tamanho, evento e deduplicação. No runtime publicado ele fica desativado (sem segredo). Sua execução foi testada localmente com eventos sintéticos, não com chamadas da Clicksign.

## Adaptador externo isolado

O adaptador mantém o endpoint fixo `sandbox.clicksign.com`, qualificação de signatário, checkpoints e leitura de PDF assinado com hosts permitidos e limite de tamanho. Exige habilitação explícita para teste e modo embedded; notificações externas ficam bloqueadas. Não está conectado ao fluxo do painel.

Para comprovar a integração externa faltam credenciais novas, signatário de teste autorizado, confirmação de permissões/regras atuais da API e ensaio controlado de ponta a ponta. Minutas exigem revisão jurídica, identificação empresarial e preços efetivos. Nenhuma aprovação é presumida.

Veja [a entrega e as limitações](plataforma/README.md).
