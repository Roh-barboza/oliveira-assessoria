# Mapa funcional IRPF 2026

O checklist e a futura extensão seguem os blocos publicados pela Receita Federal no manual do Meu Imposto de Renda: Pessoas, Rendimentos, Pagamentos ou Doações, Patrimônio, Destinação, Resumo e Entrega.

Fontes oficiais consultadas em 21/09/2026:

- Manual: <https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/preenchimento/manual-mir>
- Pessoas: <https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/preenchimento/manual-mir/pessoas>
- Rendimentos: <https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/preenchimento/manual-mir/rendimentos>
- Pré-preenchida: <https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/preenchimento/declaracao-pre-preenchida>
- Autorizações de acesso: <https://www.gov.br/receitafederal/pt-br/assuntos/procuracoes>

## Mapeamento inicial

| Bloco MIR | Dados na ficha | Estratégia da extensão |
|---|---|---|
| Pessoas / Titular | identificação, endereço e ocupação | comparar dados recuperados; não sobrescrever cadastro-base sem revisão |
| Pessoas / Outras pessoas | dependentes e alimentandos | cadastrar/revisar um registro por pessoa |
| Rendimentos | beneficiário, natureza, fonte e valor | comparar informe do cliente com pré-preenchida |
| Pagamentos ou Doações | beneficiário, tipo, recebedor e valor | preencher após validar comprovante e CPF/CNPJ |
| Patrimônio | bens, direitos e dívidas | preencher descrição e saldos por item |
| Destinação | ainda não automatizado | manter manual no MVP |
| Resumo | resultado calculado pelo MIR | somente leitura e conferência |
| Entrega | revisão e transmissão | sempre manual |

## Regras de comparação

- Registro idêntico: marcar como conferido, sem reescrever.
- Valor divergente: exibir ambos e interromper alteração automática.
- Documento ausente: criar pendência; não inferir valor.
- Registro presente apenas na pré-preenchida: exigir conferência.
- Registro presente apenas na ficha: solicitar comprovante antes de incluir.
