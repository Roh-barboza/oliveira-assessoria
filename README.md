# Oliveira Assessoria Jurídica

Repositório central para o projeto da **Oliveira Assessoria Jurídica**. Este projeto inclui uma landing page para captação de leads e um agente de IA com base de conhecimento jurídica.

## Estrutura do Repositório
- `/landing`: Interface da landing page (HTML, CSS, JS).
- `/agent`: Script de seed de conhecimento e integrações de IA.
- `/db`: Schema do banco de dados PostgreSQL (`schema.sql`).

## Configuração do Banco de Dados (PostgreSQL)

O projeto utiliza **PostgreSQL** com a extensão **pgvector** para busca semântica.

1.  Certifique-se de que o PostgreSQL está instalado e rodando.
2.  Crie o banco de dados (ex: `oliveira_db`).
3.  Aplique o schema:
    ```bash
    psql -h seu_host -U seu_usuario -d oliveira_db -f db/schema.sql
    ```

## Configuração do Agente e Seed

O script `agent/seed-knowledge.js` popula o banco com conhecimento jurídico e gera embeddings usando a API do **Google Gemini**.

1.  Navegue até a pasta `agent`:
    ```bash
    cd agent
    ```
2.  Instale as dependências:
    ```bash
    npm install
    ```
3.  Configure as variáveis de ambiente:
    - Copie `.env.example` para `.env`.
    - Preencha com suas credenciais do Postgres e sua `GEMINI_API_KEY`.
4.  Execute o seed:
    ```bash
    npm run seed
    ```

## Integração da Landing Page

A landing page envia leads para um webhook do **n8n**.

1.  O formulário em `landing/index.html` é processado por `landing/script.js`.
2.  Certifique-se de que a URL do webhook em `landing/script.js` está correta.
3.  O webhook deve estar configurado para receber um POST JSON com os campos: `nome`, `whatsapp`, `area`, `mensagem`.

## Tecnologias Utilizadas
- **Frontend:** HTML5, CSS3, JavaScript Vanilla.
- **Backend/IA:** Node.js, Google Generative AI (Gemini), pgvector.
- **Banco de Dados:** PostgreSQL.
- **Automação:** n8n.

---
© 2025 Oliveira Assessoria - Seus direitos. Simples assim.
