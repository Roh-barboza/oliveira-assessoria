import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { OperationalAccounts } from "../server/platform/operational-accounts.mjs";
import { OperationalMfa } from "../server/platform/operational-mfa.mjs";
import { OperationalLoginLimiter } from "../server/platform/operational-login-limiter.mjs";
import { OperationalInvitations } from "../server/platform/operational-invitations.mjs";
import { prepareStaffAccount, verifyStaffPassword } from "../server/platform/operational-identity.mjs";
import { totpForCounter } from "../server/platform/totp.mjs";
import { createOperationalHttp } from "../server/platform/operational-http.mjs";

const key = randomBytes(32).toString("hex");
const rate = "only-test-independent-secret-longer-than-32-chars";
const url = "https://ops.example.test";
const oneTime = () => Math.floor(Date.now() / 30000);
async function setup() {
  const db = new PGlite();
  const accounts = new OperationalAccounts(db);
  await accounts.setup();
  await new OperationalMfa(accounts,key).setup();
  await new OperationalLoginLimiter(db,rate).setup();
  const invitations = new OperationalInvitations(db,key,rate);
  await invitations.setup();
  const admin = await prepareStaffAccount({
    email:"admin@example.test", name:"Administrador", role:"admin",
    password:"A-long-random-password-for-test-only",
  });
  await accounts.createPrepared(admin);
  await accounts.changeStatus(admin.id,"active");
  return { db,accounts,invitations,admin };
}

test("private invitations enroll non-admin staff with TOTP and do not reveal secrets in DB", async () => {
  const {db,accounts,invitations,admin} = await setup();
  try {
    await assert.rejects(
      invitations.invite("11111111-1111-4111-8111-111111111111",{
        email:"worker@example.test",name:"Atendimento",role:"operator",
      }), {status:403});
    await assert.rejects(
      invitations.invite(admin.id,{
        email:"other@example.test",name:"Admin oculto",role:"admin",
      }), {status:422});
    const invitation=await invitations.invite(admin.id,{
      email:"WORKER@example.test",name:"Atendimento",role:"operator",
    });
    assert.match(invitation.token,/^[a-f0-9]{64}$/);
    assert.equal(invitation.email,"worker@example.test");
    const raw=await db.query("SELECT * FROM oliveira_staff_invitations");
    assert.equal(raw.rows.length,1);
    assert.equal(JSON.stringify(raw.rows[0]).includes(invitation.token),false);
    await assert.rejects(invitations.invite(admin.id,{
      email:"worker@example.test",name:"Atendimento",role:"operator",
    }), {status:409});
    await assert.rejects(invitations.redeem({token:"f".repeat(64),
      password:"A-strong-new-employee-password-1234"}), {status:409});
    const activated=await invitations.redeem({
      token:invitation.token,password:"A-strong-new-employee-password-1234",
    });
    assert.equal(activated.email,"worker@example.test");
    assert.ok(activated.totpSecret);
    const pending=await accounts.findByEmail("worker@example.test");
    assert.equal(pending.status,"pending-mfa");
    await assert.rejects(invitations.redeem({token:invitation.token,
      password:"A-strong-new-employee-password-1234"}), {status:409});
    await assert.rejects(invitations.confirm({token:invitation.token,code:"not-a-code"}),{status:422});
  } finally {await db.close();}
});

test("enrollment becomes active only on valid MFA and token cannot be replayed", async () => {
  const {db,accounts,invitations,admin}=await setup();
  try {
    const i=await invitations.invite(admin.id,{
      email:"reviewer@example.test",name:"Revisor",role:"reviewer",
    });
    const enrollment=await invitations.redeem({
      token:i.token,password:"A-reviewer-password-long-enough-1234",
    });
    const code=totpForCounter(enrollment.totpSecret,oneTime());
    assert.deepEqual(await invitations.confirm({token:i.token,code}),{activated:true});
    assert.equal((await accounts.findByEmail("reviewer@example.test")).status,"active");
    await assert.rejects(invitations.confirm({token:i.token,code}),{status:409});
    await assert.rejects(invitations.redeem({
      token:i.token,password:"Another-strong-long-password-1234",
    }),{status:409});
  } finally {await db.close();}
});

test("admin reset revokes sessions, requires new password and TOTP, never permits self-reset", async () => {
  const {db,accounts,invitations,admin}=await setup();
  try {
    const worker=await prepareStaffAccount({
      email:"operator@example.test",name:"Operadora",role:"operator",
      password:"Old-operation-password-for-test-1234",
    });
    await accounts.createPrepared(worker);
    await accounts.changeStatus(worker.id,"active");
    const session=await accounts.createSession(
      await accounts.findByEmail(worker.email),{mfaVerified:true});
    await assert.rejects(invitations.reset(admin.id,admin.id),{status:404});
    await assert.rejects(invitations.reset(worker.id,worker.id),{status:403});
    const reset=await invitations.reset(admin.id,worker.id);
    const replacement=await invitations.reset(admin.id,worker.id);
    assert.notEqual(reset.token,replacement.token);
    await assert.rejects(invitations.redeem({
      token:reset.token,password:"Replacement-password-very-long-1234",
    }),{status:409});
    assert.equal(await accounts.getSession(session.token),null);
    assert.equal((await accounts.findByEmail(worker.email)).status,"pending-mfa");
    const recovered=await invitations.redeem({
      token:replacement.token,password:"Replacement-password-very-long-1234",
    });
    const pending=await accounts.findByEmail(worker.email);
    assert.equal(await verifyStaffPassword(pending,"Old-operation-password-for-test-1234"),false);
    assert.equal(await verifyStaffPassword(pending,"Replacement-password-very-long-1234"),true);
    const code=totpForCounter(recovered.totpSecret,oneTime());
    assert.deepEqual(await invitations.confirm({token:replacement.token,code}),{activated:true});
    assert.equal((await accounts.findByEmail(worker.email)).status,"active");
    assert.equal(await accounts.getSession(session.token),null);
  } finally {await db.close();}
});

test("HTTP enrollment endpoints reject anonymous administration and unknown fields", async () => {
  const {db,accounts,invitations,admin}=await setup();
  try {
    const token="A".repeat(43);
    const handler=createOperationalHttp({
      authentication:{login:async()=>({authenticated:false})},
      accounts:{
        getSession:async candidate => candidate===token
          ? {id:admin.id,role:"admin"} : null,
        revoke:async()=>{},
      },
      invites:invitations,
      allowedOrigin:url,networkIdentity:()=> "trusted-network",
    });
    const call=(op,body,authenticated=true,headers={})=>
      handler(new Request(url+"/api/operacional?op="+op,{
        method:"POST",headers:{
          origin:url,"content-type":"application/json",
          ...(authenticated?{cookie:"__Host-oliveira-ops="+token}:{}),...headers,
        },body:JSON.stringify(body),
      }));
    assert.equal((await call("staff-invite",{
      email:"tester@example.test",name:"Operadora",role:"operator",
    },false)).status,401);
    assert.equal((await call("staff-invite",{
      email:"tester@example.test",name:"Operadora",role:"operator",
      superuser:true,
    })).status,422);
    assert.equal((await call("staff-invite",{
      email:"tester@example.test",name:"Operadora",role:"operator",
    },true,{origin:"https://evil.example.test"})).status,403);
    const created=await call("staff-invite",{
      email:"tester@example.test",name:"Operadora",role:"operator",
    });
    assert.equal(created.status,201);
    const issued=(await created.json()).invitation;
    const redeem=await call("invite-redeem",{
      token:issued.token,password:"Very-long-private-password-123456",
    },false);
    assert.equal(redeem.status,200);
    const enrolled=(await redeem.json()).enrollment;
    assert.ok(enrolled.totpSecret);
    assert.equal((await call("invite-confirm",{
      token:issued.token,code:totpForCounter(enrolled.totpSecret,oneTime()),
    },false)).status,200);
  } finally {await db.close();}
});
