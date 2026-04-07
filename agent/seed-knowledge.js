/**
 * seed-knowledge.js
 * Insere a base jurídica no Postgres com embeddings Gemini
 */

require('dotenv').config();
const { Pool } = require('pg');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// ─── CONFIG ───────────────────────────────────────────────────────────────────

const pool = new Pool({
  host:     process.env.PG_HOST,
  port:     parseInt(process.env.PG_PORT || '5432'),
  user:     process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  database: process.env.PG_DB,
  ssl:      process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const embedModel = genAI.getGenerativeModel({ model: 'text-embedding-004' });

// ─── BASE DE CONHECIMENTO ─────────────────────────────────────────────────────

const artigos = [
  {
    area: 'Dívidas',
    titulo: 'Prescrição de Dívidas no Brasil — Prazos por Tipo',
    fonte: 'Código Civil Art. 205 e 206; Lei 8.078/90 (CDC)',
    tags: ['prescricao', 'divida', 'prazo', 'codigo-civil', 'negativacao'],
    conteudo: `## Resumo\nPrescrição é a perda do direito do credor de cobrar judicialmente uma dívida após determinado prazo...`
  },
  {
    area: 'Dívidas',
    titulo: 'Direitos do Devedor — Proteção Contra Cobrança Abusiva',
    fonte: 'CDC Art. 42, Lei 8.078/90; Código Civil; STJ Tema 929',
    tags: ['devedor', 'cobranca-abusiva', 'assedio', 'negativacao-indevida', 'dano-moral', 'CDC'],
    conteudo: `## Resumo\nO devedor inadimplente possui direitos expressamente protegidos pelo Código de Defesa do Consumidor...`
  }
  // ... mais artigos podem ser adicionados aqui
];

async function generateEmbedding(text) {
  const result = await embedModel.embedContent(text);
  return result.embedding.values;
}

async function seed() {
  const client = await pool.connect();
  try {
    console.log('--- Iniciando Seed de Conhecimento Jurídico ---');
    
    // Limpar tabela antes de inserir (opcional, dependendo do uso)
    // await client.query('DELETE FROM conhecimento_juridico');

    for (const artigo of artigos) {
      console.log(`Processando: ${artigo.titulo}`);
      
      const embedding = await generateEmbedding(`${artigo.titulo}\n${artigo.conteudo}`);
      
      const query = `
        INSERT INTO conhecimento_juridico (area, titulo, conteudo, tags, fonte, embedding)
        VALUES ($1, $2, $3, $4, $5, $6)
      `;
      
      const values = [
        artigo.area,
        artigo.titulo,
        artigo.conteudo,
        artigo.tags,
        artigo.fonte,
        `[${embedding.join(',')}]`
      ];
      
      await client.query(query, values);
    }
    
    console.log('--- Seed concluído com sucesso! ---');
  } catch (err) {
    console.error('Erro durante o seed:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
