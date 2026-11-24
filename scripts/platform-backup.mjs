// Local, consistent SQLite snapshot. This never uploads a database or key.
import { DatabaseSync, backup } from "node:sqlite";
import { chmod, copyFile, access } from "node:fs/promises";
import { constants } from "node:fs";
import { resolve } from "node:path";
const [action, sourceArg, destinationArg] = process.argv.slice(2);
if (
  !["backup", "restore-copy"].includes(action) ||
  !sourceArg ||
  !destinationArg
)
  throw Error(
    "Uso: node scripts/platform-backup.mjs backup|restore-copy origem destino-novo",
  );
const source = resolve(sourceArg),
  destination = resolve(destinationArg);
if (source === destination) throw Error("Destino deve ser novo.");
try {
  await access(destination);
  throw Error("Destino existente; nenhuma sobrescrita autorizada.");
} catch (e) {
  if (e.code !== "ENOENT") throw e;
}
if (action === "backup") {
  const db = new DatabaseSync(source, { readOnly: true });
  try {
    await backup(db, destination);
  } finally {
    db.close();
  }
} else {
  await copyFile(source, destination, constants.COPYFILE_EXCL);
  const db = new DatabaseSync(destination, { readOnly: true });
  try {
    if (db.prepare("PRAGMA integrity_check").get().integrity_check !== "ok")
      throw Error("Cópia inválida");
  } finally {
    db.close();
  }
}
await chmod(destination, 0o600);
console.log(
  "Snapshot local cifrado pronto. Chave deve ser guardada separadamente; não incluída.",
);
