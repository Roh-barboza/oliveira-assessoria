-- Schema do banco de dados para Oliveira Assessoria (PostgreSQL)

-- Habilitar a extensão pgvector para busca semântica
CREATE EXTENSION IF NOT EXISTS vector;

-- Tipos ENUM
DO $$ BEGIN
    CREATE TYPE status_lead AS ENUM ('Novo', 'Em Atendimento', 'Concluído', 'Arquivado');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE area_juridica AS ENUM ('Dívidas', 'INSS/Previdência', 'Precatórios', 'Imposto de Renda', 'Contratos', 'Outro');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE tipo_sessao AS ENUM ('Chat', 'WhatsApp', 'Presencial');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Tabela de Clientes/Leads
CREATE TABLE IF NOT EXISTS leads (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    whatsapp VARCHAR(20) NOT NULL UNIQUE,
    area_interesse area_juridica NOT NULL,
    mensagem TEXT,
    status status_lead DEFAULT 'Novo',
    data_criacao TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    data_atualizacao TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Casos Jurídicos
CREATE TABLE IF NOT EXISTS casos (
    id SERIAL PRIMARY KEY,
    lead_id INTEGER REFERENCES leads(id) ON DELETE CASCADE,
    titulo VARCHAR(255) NOT NULL,
    descricao TEXT,
    status VARCHAR(50) DEFAULT 'Em análise',
    data_abertura TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Conhecimento Jurídico (RAG)
CREATE TABLE IF NOT EXISTS conhecimento_juridico (
    id SERIAL PRIMARY KEY,
    area VARCHAR(100),
    titulo VARCHAR(255) NOT NULL,
    conteudo TEXT NOT NULL,
    tags TEXT[],
    fonte TEXT,
    embedding vector(768), -- text-embedding-004 usa 768 dimensões
    data_criacao TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Sessões/Interações
CREATE TABLE IF NOT EXISTS sessoes (
    id SERIAL PRIMARY KEY,
    lead_id INTEGER REFERENCES leads(id) ON DELETE CASCADE,
    tipo tipo_sessao DEFAULT 'Chat',
    historico_json JSONB,
    resumo_ia TEXT,
    data_inicio TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    data_fim TIMESTAMP WITH TIME ZONE
);

-- Tabela de Agendamentos
CREATE TABLE IF NOT EXISTS agendamentos (
    id SERIAL PRIMARY KEY,
    lead_id INTEGER REFERENCES leads(id) ON DELETE CASCADE,
    data_hora TIMESTAMP WITH TIME ZONE NOT NULL,
    local VARCHAR(255),
    status VARCHAR(50) DEFAULT 'Agendado',
    notas TEXT
);

-- Tabela de Pagamentos
CREATE TABLE IF NOT EXISTS pagamentos (
    id SERIAL PRIMARY KEY,
    lead_id INTEGER REFERENCES leads(id) ON DELETE CASCADE,
    valor DECIMAL(10, 2) NOT NULL,
    status VARCHAR(50) DEFAULT 'Pendente',
    metodo VARCHAR(50),
    data_pagamento TIMESTAMP WITH TIME ZONE,
    referencia_externa VARCHAR(255)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_leads_whatsapp ON leads(whatsapp);
CREATE INDEX IF NOT EXISTS idx_conhecimento_area ON conhecimento_juridico(area);
CREATE INDEX IF NOT EXISTS idx_conhecimento_embedding ON conhecimento_juridico USING ivfflat (embedding vector_l2_ops) WITH (lists = 100);

-- Trigger para atualizar data_atualizacao em leads
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.data_atualizacao = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_leads_updated_at
    BEFORE UPDATE ON leads
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();
