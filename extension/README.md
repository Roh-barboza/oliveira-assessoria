# Oliveira Assistant — IRPF (MVP 0.1.0)

Extensão Chrome Manifest V3 para importar a ficha estruturada do cliente, mapear os campos da página atual e, somente depois da validação do mapa, auxiliar o preenchimento.

## Instalação local

1. Abra `chrome://extensions`.
2. Ative o **Modo do desenvolvedor**.
3. Clique em **Carregar sem compactação**.
4. Selecione a pasta `extension` deste repositório.

## Fluxo seguro

1. O cliente ou a equipe preenche `landing/ir/formulario.html`.
2. A ficha JSON é gerada localmente.
3. A Jennifer faz o login manual no Meu Imposto de Renda.
4. A extensão importa a ficha.
5. **Mapear campos da tela** coleta somente metadados (rótulo, nome, id e tipo), nunca valores já preenchidos.
6. O adaptador de cada tela é validado antes de habilitar o preenchimento.
7. A transmissão final permanece manual.

## Estado atual

- Importação e validação básica da ficha: pronta.
- Armazenamento local da ficha no Chrome: pronto.
- Scanner de campos sem coleta de valores: pronto.
- Laboratório local de preenchimento: pronto em `landing/ir/laboratorio.html`.
- Adaptadores reais do portal da Receita: pendentes de captura autenticada e validação tela a tela.
- CAPTCHA, senha, OTP, autenticação e transmissão: deliberadamente fora do escopo.

## Como gerar o mapa real

Após o login manual, abra uma tela do Meu Imposto de Renda e clique em **Mapear campos da tela**. Use **Copiar mapa técnico** e salve o JSON para análise. Revise o conteúdo antes de compartilhar; o scanner foi desenhado para não incluir valores, mas a revisão humana continua obrigatória.
