import pg from 'pg';

export function postgres(url, local) {
  return new pg.Pool({
    connectionString: url, max: 3, connectionTimeoutMillis: 4000, idleTimeoutMillis: 10000,
    statement_timeout: 6000, ssl: local ? undefined : { rejectUnauthorized: true }
  });
}

export async function transaction(pool, run) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await run(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function audit(db, id, actor, action, detail = null) {
  await db.query('INSERT INTO contratacao.audit (contract_id, actor, action, detail) VALUES ($1, $2, $3, $4)', [id, actor, action, detail]);
}

export async function rate(db, scope, limit, windowSeconds) {
  const bucket = Math.floor(Date.now() / (windowSeconds * 1000)) * windowSeconds;
  const { rows: [row] } = await db.query(`
    INSERT INTO contratacao.rate_limits (scope, bucket, requests) VALUES ($1, $2, 1)
    ON CONFLICT (scope, bucket) DO UPDATE SET requests = contratacao.rate_limits.requests + 1
    RETURNING requests`, [scope, bucket]);
  return row.requests <= limit;
}
