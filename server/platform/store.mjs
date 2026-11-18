import { encryption } from './security.mjs';

// Compare-and-swap is the persistence boundary. Callbacks must have no external side effects.
export class StateRepository {
  constructor(store, key) { this.store = store; this.cipher = encryption(key); }
  async read(id) {
    const row = await this.store.read(id);
    return row ? { version: row.version, value: JSON.parse(this.cipher.open(row.data, id).toString()) } : null;
  }
  async create(id, value) {
    const data = this.cipher.seal(Buffer.from(JSON.stringify(value)), id);
    if (!await this.store.cas(id, null, data)) throw Object.assign(Error('Conflito de criação.'), { status: 409 });
  }
  async change(id, run) {
    for (let attempt = 0; attempt < 4; attempt++) {
      const record = await this.read(id);
      if (!record) throw Object.assign(Error('Ambiente não encontrado ou reiniciado.'), { status: 401 });
      const result = await run(record.value);
      const json = JSON.stringify(record.value);
      if (Buffer.byteLength(json) > 2000000) throw Object.assign(Error('Limite do ambiente sintético atingido.'), { status: 413 });
      if (await this.store.cas(id, record.version, this.cipher.seal(Buffer.from(json), id))) return result;
    }
    throw Object.assign(Error('Atualização concorrente; recarregue e tente novamente.'), { status: 409 });
  }
}

export class MemoryStore {
  mode = 'temporario'; rows = new Map();
  async read(id) { const r = this.rows.get(id); return r ? { ...r } : null; }
  async cas(id, version, data) {
    const row = this.rows.get(id);
    if ((row?.version ?? null) !== version) return false;
    this.rows.set(id, { version: (version ?? 0) + 1, data }); return true;
  }
}

export class BlobStore {
  mode = 'blob-privado';
  constructor({ get, put, storeId }) { Object.assign(this, { get, put, storeId }); }
  path(id) { return `oliveira-preview-v1/${id}.enc`; }
  async read(id) {
    const result = await this.get(this.path(id), { access: 'private', storeId: this.storeId, useCache: false });
    if (!result) return null;
    if (result.statusCode !== 200) throw Error('Leitura privada indisponível.');
    return { version: result.blob.etag, data: Buffer.from(await new Response(result.stream).arrayBuffer()) };
  }
  async cas(id, version, data) {
    try {
      await this.put(this.path(id), data, { access: 'private', storeId: this.storeId, addRandomSuffix: false,
        contentType: 'application/octet-stream', ...(version ? { ifMatch: version } : { allowOverwrite: false }) });
      return true;
    } catch (e) {
      if (['BlobPreconditionFailedError', 'BlobAlreadyExistsError'].includes(e.name)) return false;
      throw e;
    }
  }
}

export class PostgresStore {
  mode = 'postgres';
  constructor(pool) { this.pool = pool; }
  async read(id) {
    const { rows } = await this.pool.query('SELECT version, payload AS data FROM oliveira_platform_state WHERE id=$1', [id]);
    return rows[0] ? { ...rows[0], version: Number(rows[0].version) } : null;
  }
  async cas(id, version, data) {
    const q = version === null
      ? await this.pool.query('INSERT INTO oliveira_platform_state(id,version,payload) VALUES($1,1,$2) ON CONFLICT DO NOTHING RETURNING id', [id, data])
      : await this.pool.query('UPDATE oliveira_platform_state SET version=version+1,payload=$3 WHERE id=$1 AND version=$2 RETURNING id', [id, version, data]);
    return q.rows.length === 1;
  }
}
