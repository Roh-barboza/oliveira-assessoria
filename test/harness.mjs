import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { createApp, runtime } from '../server/contratacao/app.mjs';
import { digest, passwordHash } from '../server/contratacao/privacy.mjs';

export const invite = 'convite-ficticio-local';
export const adminPassword = 'senha-ficticia-local';
export const token = 'token-ficticio-local';
export const secret = 'webhook-ficticio-local';

export async function testHarness(origin = 'http://127.0.0.1:3000', provider) {
  const database = new PGlite();
  await database.exec(await readFile(new URL('../db/contratacao-sandbox.sql', import.meta.url), 'utf8'));
  // PGlite uses one connection. Serialize independent transactions while letting
  // each transaction run its own statements and exercise real SQL constraints.
  let next = Promise.resolve();
  async function lock() {
    const previous = next;
    let release;
    next = new Promise(resolve => { release = resolve; });
    await previous;
    return release;
  }
  async function query(sql, values) {
    const result = await database.query(sql, values);
    return { ...result, rowCount: result.affectedRows ?? result.rows.length };
  }
  const pool = {
    async query(...args) {
      const release = await lock();
      try { return await query(...args); } finally { release(); }
    },
    async connect() {
      return { query, release: await lock() };
    }
  };
  const salt = '12'.repeat(16);
  const env = {
    CONTRACTS_SANDBOX: '1', CONTRACTS_LOCAL: '1', CONTRACTS_ORIGIN: origin, CLICKSIGN_ENV: 'sandbox',
    CONTRACT_ENCRYPTION_KEY: '01'.repeat(32), CONTRACT_TEST_INVITE_SHA256: digest(invite),
    CONTRACT_ADMIN_JENNIFER_SCRYPT: `${salt}:${await passwordHash(adminPassword, salt)}`,
    CONTRACT_ADMIN_RODRIGO_SCRYPT: `${salt}:${await passwordHash(adminPassword, salt)}`,
    CLICKSIGN_ACCESS_TOKEN: token, CLICKSIGN_TEST_EMAIL: 'sandbox@example.test', CLICKSIGN_WEBHOOK_SECRET: secret
  };
  return { database, pool, env, app: createApp({ pool, env, settings: runtime(env), provider }) };
}
