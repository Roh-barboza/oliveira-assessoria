-- Schema do banco de dados para Oliveira Assessoria
-- Este arquivo define a estrutura básica para armazenamento de leads e consultas

CREATE TABLE IF NOT EXISTS leads (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    whatsapp VARCHAR(20) NOT NULL,
    area_interesse ENUM('Dívidas', 'INSS/Previdência', 'Precatórios', 'Imposto de Renda', 'Contratos', 'Outro') NOT NULL,
    mensagem TEXT,
    data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status ENUM('Novo', 'Em Atendimento', 'Concluído', 'Arquivado') DEFAULT 'Novo'
);

CREATE TABLE IF NOT EXISTS consultas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    lead_id INT,
    data_consulta DATETIME,
    notas_ia TEXT,
    plano_acao TEXT,
    FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
);
