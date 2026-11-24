import { createCipheriv, createDecipheriv, randomBytes, createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { open, rm, stat } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { Transform } from "node:stream";

export const BACKUP_MAGIC = Buffer.from("OLIVOPS1");
const IV_BYTES = 12;
const TAG_BYTES = 16;
const HEADER_BYTES = BACKUP_MAGIC.length + IV_BYTES;

/**
 * Streaming AES-256-GCM format: "OLIVOPS1" + random nonce(12) + ciphertext + tag(16).
 * Never writes a plaintext dump to disk. The independent backup key must be
 * stored separately from both the encrypted archive and the application's data key.
 */
export function backupKey(value) {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value))
    throw new Error("Chave independente de backup ausente ou inválida.");
  return Buffer.from(value, "hex");
}
export async function encryptStream(source, destinationPath, key) {
  const iv=randomBytes(IV_BYTES);
  const cipher=createCipheriv("aes-256-gcm",key,iv);
  const output=createWriteStream(destinationPath,{flags:"wx",mode:0o600});
  try {
    await new Promise((resolve,reject)=>{
      output.write(Buffer.concat([BACKUP_MAGIC,iv]),error=>error?reject(error):resolve());
    });
    await pipeline(source,cipher,output,{end:false});
    await new Promise((resolve,reject)=>output.end(cipher.getAuthTag(),e=>e?reject(e):resolve()));
  } catch(error) {
    output.destroy();
    await rm(destinationPath,{force:true}).catch(()=>{});
    throw error;
  }
}
export async function decryptToStream(sourcePath,destination,key) {
  const info=await stat(sourcePath);
  if(info.size<=HEADER_BYTES+TAG_BYTES)throw new Error("Arquivo de backup truncado.");
  const handle=await open(sourcePath,"r");
  const header=Buffer.alloc(HEADER_BYTES);
  const tag=Buffer.alloc(TAG_BYTES);
  try {
    await handle.read(header,0,HEADER_BYTES,0);
    await handle.read(tag,0,TAG_BYTES,info.size-TAG_BYTES);
  } finally {await handle.close();}
  if(!header.subarray(0,BACKUP_MAGIC.length).equals(BACKUP_MAGIC))
    throw new Error("Formato do backup inválido.");
  const decipher=createDecipheriv("aes-256-gcm",key,header.subarray(BACKUP_MAGIC.length));
  decipher.setAuthTag(tag);
  await pipeline(createReadStream(sourcePath,{
    start:HEADER_BYTES,end:info.size-TAG_BYTES-1,
  }),decipher,destination,{end:false});
}
export async function encryptedSha256(path) {
  const hash=createHash("sha256");
  for await(const chunk of createReadStream(path))hash.update(chunk);
  return hash.digest("hex");
}
