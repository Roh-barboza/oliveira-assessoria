# Oliveira Assessoria | Backup e recuperação do Neon

**Situação em 23/11/2026:** conexão com Neon e tabelas operacionais verificadas. Ainda NÃO existe nesta entrega um backup lógico independente restaurado e homologado. Este documento define o procedimento, não afirma que ele foi executado.

## Riscos e requisitos

- O plano gratuito Neon, quando utilizado, oferece uma janela curta de recuperação pontual (documentação de 2026: **até 6 horas ou 1 GB de histórico**, o que for menor). Não é substituto de um backup independente de longo prazo. Consulte https://neon.com/docs/postgres/backup-restore e https://neon.com/docs/introduction/free-tier .
- Conservar **fora do GitHub, mensagens e logs** a chave `OLIVEIRA_OPS_DATA_KEY`, pois ela protege campos de atendimentos e segredos MFA criptografados. Um dump do banco sem essa chave não recupera os dados de casos; a chave sem o dump tampouco recupera os registros.
- Nunca restaurar ou testar diretamente na branch de banco com funcionários reais.
- Controles de acesso do console Neon, auditoria, segregação das credenciais Preview/produção e revisão LGPD devem ser validados pelo responsável antes de dados reais.

## Procedimento de backup lógico independente (administrador autorizado)

Executar em máquina ou runner privado com PostgreSQL client correspondente à versão do servidor, usando credenciais de backup de privilégio mínimo. Não compartilhar a string de conexão.

1. Confirmar, no console Neon, o **projeto**, a **branch** e o banco operacionais. Se disponível, criar snapshot/branch de segurança anterior a mudanças de esquema.
2. Em sessão de terminal privada, apontar uma variável de ambiente somente em memória para a string de conexão TLS.
3. Gerar arquivo em formato custom com pg_dump, sem publicar em CI artifact:
   `pg_dump --dbname="$OLIVEIRA_OPS_BACKUP_URL" --format=custom --no-owner --no-privileges --file="oliveira-ops-$(date -u +%Y%m%dT%H%M%SZ).dump"`
4. Criptografar o arquivo com uma chave de backup independente, guardada em gerenciador de segredos; enviar somente a um cofre privado com acesso restrito e políticas de retenção.
5. Registrar hash SHA-256, data, tamanho e versão do esquema. Não colocar a chave de criptografia de dados da aplicação no mesmo pacote.
6. Reter cópias em local diferente do banco; definir e cumprir periodicidade, retenção e alertas de falha de acordo com o RPO/RTO aprovado.

## Ensaio de restauração obrigatório

1. Criar um **outro banco ou branch Neon de restauração**, sem conectá-lo ao domínio público.
2. Executar `pg_restore --dbname="$OLIVEIRA_OPS_RESTORE_URL" --no-owner --no-privileges --exit-on-error "backup.dump"` com credenciais limitadas.
3. Validar presença das tabelas `oliveira_staff_accounts`, `oliveira_staff_sessions`, `oliveira_staff_mfa`, `oliveira_login_limits` e `oliveira_operational_cases`; confrontar contagens sem exportar dados pessoais em logs.
4. Com a chave da aplicação obtida exclusivamente no cofre, testar leitura de **registro sintético** e sua alteração de etapa. Nunca colar valores decifrados em relatório.
5. Verificar isolamento: o aplicativo público e a API do ambiente principal devem continuar apontando para o banco anterior.
6. Documentar resultado, tempo de restauração e responsáveis. Remover o banco temporário conforme política aplicável.

Em incidentes reais, revogar sessões após restauração e avaliar troca de senhas/segredos. Não rotacionar `OLIVEIRA_OPS_DATA_KEY` sem migração completa do material cifrado.

## Critérios de aprovação

- [ ] Backup do banco real criado e criptografado fora do Neon
- [ ] Cópia armazenada com acesso restrito e retenção definida
- [ ] Restauração em destino separado concluída e conferida
- [ ] Recuperação do segredo de criptografia validada pelo responsável, sem revelar o valor
- [ ] RPO/RTO e alertas de backup aprovados
- [ ] Permissões e política LGPD revisadas

**Até que estes itens sejam comprovados, o estado de backup permanece NÃO HOMOLOGADO.**
