# Evidências de validação

## Backend, finanças e segurança

`npm run test:platform`: **25 testes passaram, zero falhas** na execução local de 18/11/2026. Inclui isolamento de dois clientes, RBAC, origem/CSRF, mass assignment, criptografia/tamper, CAS concorrente, persistência SQLite/reabertura, SQL Postgres em PGlite, Blob privado simulado, primeira/segunda revisão, FAST IT invertido, T0 e marcos, revisões, rascunho, autorização, opt-in/deduplicação/pausa/encerramento, PDF/hash/assinatura, pagamentos idempotentes, webhook HMAC, descarte, falha Clicksign mockada, Drive privado mockado, regras WhatsApp e falha segura do adaptador de modelo. Backup/restauração SQLite consistente também executados.

`npm audit --omit=dev`: **zero vulnerabilidades reportadas** após atualizar a dependência transitiva `@vercel/cli-config` para 0.4.0 via override. Esse resultado não substitui revisão de segurança de produção.

## Navegador

`npm run test:platform-ui`: execução local passou no fluxo completo com quatro identidades. Solicitação → fixture privado → T0 → PDF/convite interno → tarefa de follow-up → cálculo interno → Jennifer → Rodrigo → cliente assinando no simulador → segundo cliente sem acesso ao caso.

Verificados 360, 390, 430, 768, 1366 e 1920 px sem overflow na tela do caso. Axe sem violações nos estados avaliados de caso administrativo, precificação e cliente. Capturas excluem o bloco de credenciais.

A regressão pública, Lighthouse e validação do deploy serão registradas abaixo após a execução final. Nenhuma chamada aos órgãos oficiais, Drive, Clicksign, LLM, adquirente ou WhatsApp real foi usada como evidência. O formulário n8n existente é interceptado nos testes, sem envio real.
