import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { OperationalCases } from "../server/platform/operational-cases.mjs";
import { OperationalAccounts } from "../server/platform/operational-accounts.mjs";
import { prepareStaffAccount } from "../server/platform/operational-identity.mjs";

async function context() {
  const db = new PGlite();
  const accounts = new OperationalAccounts(db);
  await accounts.setup();
  const users = {};
  for (const [name,role] of [["admin","admin"],["one","operator"],["two","operator"],["reader","reviewer"]]) {
    const prepared = await prepareStaffAccount({
      email: `${name}@example.test`, name, role,
      password: "A-long-unique-password-for-the-operational-test",
    });
    await accounts.createPrepared(prepared);
    await accounts.changeStatus(prepared.id,"active");
    users[name] = prepared;
  }
  const cases = new OperationalCases(db,randomBytes(32).toString("hex"));
  await cases.setup();
  return { db, accounts, cases, users };
}

test("operational cases encrypt their metadata and survive repository reads", async () => {
  const { db,cases,users } = await context();
  try {
    const item = await cases.create(users.one.id, {
      title: "Solicitação interna exemplo", service: "Documentação", notes: "Somente dados sintéticos",
    });
    assert.equal(item.status,"triagem");
    assert.deepEqual(item.recentEvents.map(event=>event.action),["created"]);
    assert.equal(item.recentEvents[0].to,"triagem");
    const { rows } = await db.query("SELECT encrypted_payload FROM oliveira_operational_cases WHERE id=$1",[item.id]);
    assert.equal(Buffer.from(rows[0].encrypted_payload).includes(Buffer.from(item.title)),false);
    assert.equal((await cases.get(users.one.id,item.id)).title,item.title);
    assert.equal((await cases.list(users.one.id)).length,1);
    assert.equal((await cases.list(users.two.id)).length,0);
    assert.equal(await cases.get(users.two.id,item.id),null);
    assert.equal((await cases.list(users.admin.id)).length,1);
  } finally {
    await db.close();
  }
});

test("operational cases prevent cross-operator updates and version conflicts", async () => {
  const { db,cases,users } = await context();
  try {
    const item = await cases.create(users.one.id, { title:"Caso sintético",service:"AIRE" });
    await assert.rejects(cases.create(users.reader.id, { title:"Caso",service:"AIRE" }),
      { status:403 });
    await assert.rejects(cases.create(users.one.id, {
      title:"Caso",service:"AIRE",assignedTo:users.two.id,
    }), { status:403 });
    await assert.rejects(cases.changeStatus(users.two.id,item.id,{
      nextStatus:"conferencia",expectedVersion:1,
    }), { status:404 });
    const next = await cases.changeStatus(users.one.id,item.id,{
      nextStatus:"conferencia",expectedVersion:1,
    });
    assert.equal(next.version,2);
    assert.equal(next.recentEvents.length,2);
    assert.deepEqual(next.recentEvents[1], {
      action:"status_changed", actorId:users.one.id,
      at:next.recentEvents[1].at,from:"triagem",to:"conferencia",
    });
    await assert.rejects(cases.changeStatus(users.one.id,item.id,{
      nextStatus:"preparado",expectedVersion:1,
    }), { status:409 });
    await assert.rejects(cases.changeStatus(users.one.id,item.id,{
      nextStatus:"encerrado",expectedVersion:2,
    }), { status:403 });
    const closed = await cases.changeStatus(users.admin.id,item.id,{
      nextStatus:"encerrado",expectedVersion:2,
    });
    assert.equal(closed.status,"encerrado");
    assert.equal(closed.recentEvents.length,3);
    assert.equal(closed.recentEvents[2].actorId,users.admin.id);
    assert.equal(closed.recentEvents[2].to,"encerrado");
    assert.equal(closed.previousEvents,0);
    const {rows: raw}=await db.query(
      "SELECT encrypted_payload FROM oliveira_operational_cases WHERE id=$1",[item.id]);
    assert.equal(Buffer.from(raw[0].encrypted_payload).includes(
      Buffer.from("status_changed")),false);
    await assert.rejects(cases.changeStatus(users.admin.id,item.id,{
      nextStatus:"triagem",expectedVersion:3,
    }), { status:403 });
  } finally {
    await db.close();
  }
});
