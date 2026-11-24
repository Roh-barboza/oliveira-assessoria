import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { Readable, Writable } from "node:stream";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { backupKey, encryptStream, decryptToStream, encryptedSha256 } from
  "../server/platform/operational-backup-crypto.mjs";

function collect() {
  const parts=[];
  const writable=new Writable({
    write(chunk,_encoding,callback){parts.push(Buffer.from(chunk));callback();}
  });
  return { writable,bytes:()=>Buffer.concat(parts) };
}

test("streaming backup encryption restores original bytes without plaintext on disk",async()=>{
  const dir=await mkdtemp(join(tmpdir(),"ops-backup-"));
  try {
    const file=join(dir,"dump.oliveira-backup.enc");
    const key=backupKey(randomBytes(32).toString("hex"));
    const payload=Buffer.concat([
      Buffer.from("PGDMP\0synthetic-private-record-123"),
      randomBytes(8192),
    ]);
    await encryptStream(Readable.from([payload]),file,key);
    const encrypted=await readFile(file);
    assert.equal(encrypted.includes(Buffer.from("synthetic-private-record-123")),false);
    const dest=collect();
    await decryptToStream(file,dest.writable,key);
    dest.writable.end();
    assert.deepEqual(dest.bytes(),payload);
    assert.match(await encryptedSha256(file),/^[a-f0-9]{64}$/);
    const dest2=collect();
    await assert.rejects(decryptToStream(file,dest2.writable,randomBytes(32)));
    const tampered=Buffer.from(encrypted);
    tampered[40]^=1;
    await writeFile(file,tampered);
    const dest3=collect();
    await assert.rejects(decryptToStream(file,dest3.writable,key));
  }finally{await rm(dir,{recursive:true,force:true});}
});
test("backup key rejects missing/weak secrets",()=>{
  for(const invalid of ["",null,"password","c".repeat(63)])
    assert.throws(()=>backupKey(invalid));
});
