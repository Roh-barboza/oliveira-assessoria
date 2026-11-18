import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, chmodSync } from 'node:fs';
import { dirname } from 'node:path';

export class SqliteStore {
  mode = 'sqlite-local';
  constructor(path) {
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(path);
    this.db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=3000; CREATE TABLE IF NOT EXISTS platform_state (id TEXT PRIMARY KEY, version INTEGER NOT NULL, payload BLOB NOT NULL)');
    chmodSync(path, 0o600);
  }
  async read(id) {
    const r = this.db.prepare('SELECT version,payload FROM platform_state WHERE id=?').get(id);
    return r ? { version: r.version, data: Buffer.from(r.payload) } : null;
  }
  async cas(id, version, data) {
    return Number((version === null
      ? this.db.prepare('INSERT OR IGNORE INTO platform_state VALUES(?,1,?)').run(id, data)
      : this.db.prepare('UPDATE platform_state SET version=version+1,payload=? WHERE id=? AND version=?').run(data, id, version)).changes) === 1;
  }
}
