# Jennifer IR Assistant — arquitetura do MVP

Atualizado em 21/09/2026.

## Objetivo

Reduzir o trabalho repetitivo de organização e preenchimento da declaração IRPF sem armazenar credenciais, contornar autenticação ou permitir transmissão automática.

```text
Página comercial
  -> checklist guiado
  -> ficha JSON versionada
  -> importação na extensão
  -> login manual
  -> mapeamento/validação da tela
  -> preenchimento assistido
  -> auditoria humana
  -> transmissão manual
```

## Componentes

| Componente | Local | Estado |
|---|---|---|
| Oferta de IRPF | `landing/imposto-de-renda.html` | Implementado |
| Checklist completo | `landing/ir/formulario.html` | Implementado |
| Modelo de dados | `landing/ir/schema-v1.json` | Implementado |
| Rascunho local | `localStorage` no navegador | Implementado |
| Extensão Manifest V3 | `extension/` | Base implementada |
| Scanner de DOM | `extension/content-script.js` | Implementado sem leitura de valores |
| Laboratório de integração | `landing/ir/laboratorio.html` | Implementado |
| Adaptadores da Receita | extensão | Pendente de mapeamento autenticado |
| Armazenamento seguro multiusuário | backend autenticado | Pendente |
| Upload de documentos | backend autenticado | Pendente |

## Limites obrigatórios

- Nunca armazenar senha, token, OTP, código de acesso ou CAPTCHA.
- Nunca preencher campos de autenticação.
- Nunca inventar um dado ausente.
- Não sobrescrever divergência sem confirmação.
- Não clicar em transmissão/entrega automaticamente.
- Registrar a origem dos dados e exigir revisão humana.
- Restringir a extensão ao domínio autorizado e ao laboratório local.

## Próxima etapa técnica

1. Abrir cada tela do MIR após login manual.
2. Usar o scanner da extensão para gerar o mapa técnico sem valores.
3. Criar um adaptador separado por tela e por exercício.
4. Testar com dados fictícios.
5. Validar preenchimento, leitura e navegação sem transmissão.
6. Somente então habilitar o botão de preenchimento naquela tela.

## Backend futuro

Antes de receber documentos reais pelo site, criar autenticação, autorização por perfil, criptografia em trânsito e em repouso, trilha de auditoria, política de retenção e fluxo de exclusão. O webhook genérico de leads não deve receber a ficha fiscal completa.
