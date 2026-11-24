import test from "node:test";
import assert from "node:assert/strict";
import { createOperationalHttp } from "../server/platform/operational-http.mjs";

const origin = "https://ops.example.test";
const token = "A".repeat(43);
const cookie = "__Host-oliveira-ops=" + token;
const id = "11111111-1111-4111-8111-111111111111";

function setup({ account = { id, role: "operator" }, casesEnabled = true } = {}) {
  const calls = [];
  const cases = {
    list: async (actor, opts) => { calls.push(["list",actor,opts]); return [{ id }]; },
    get: async (actor, item) => { calls.push(["get",actor,item]); return item === id ? { id } : null; },
    create: async (actor, data) => { calls.push(["create",actor,data]); return { id, ...data }; },
    changeStatus: async (actor, item, data) => {
      calls.push(["status",actor,item,data]);
      if (data.expectedVersion === 0)
        throw Object.assign(new Error("Database sensitive detail"), { status: 409 });
      return { id: item, status: data.nextStatus };
    },
  };
  const app = createOperationalHttp({
    allowedOrigin: origin,
    networkIdentity: () => "192.0.2.44",
    accounts: {
      getSession: async (candidate) => candidate === token ? account : null,
      revoke: async () => {},
    },
    authentication: { login: async () => ({ authenticated: false }) },
    ...(casesEnabled ? { cases } : {}),
  });
  function request(op, { method = "GET", body, authenticated = true, headers = {}, suffix = "" } = {}) {
    return app(new Request(`${origin}/api/operacional?op=${op}${suffix}`, {
      method,
      headers: {
        ...(method === "POST" ? { origin, "content-type":"application/json" } : {}),
        ...(authenticated ? { cookie } : {}), ...headers,
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    }));
  }
  return { request, calls };
}

test("operational case endpoints require a server-side session", async () => {
  const { request, calls } = setup();
  for (const op of ["case-list", "case-get", "case-create", "case-status"]) {
    const response = await request(op, { authenticated: false,
      method: op.endsWith("create") || op.endsWith("status") ? "POST" : "GET",
      body: op.endsWith("create") || op.endsWith("status") ? {} : undefined });
    assert.equal(response.status, 401);
  }
  assert.equal(calls.length, 0);
});

test("authenticated case routes dispatch to encrypted repository boundary", async () => {
  const { request, calls } = setup();
  assert.deepEqual((await (await request("case-list")).json()).cases, [{ id }]);
  assert.equal((await request("case-get", { suffix: "&id=" + id })).status, 200);
  const create = await request("case-create", { method:"POST",
    body: { title: "Atendimento de exemplo", service: "Documentação" } });
  assert.equal(create.status, 201);
  const update = await request("case-status", { method:"POST",
    body: { id, nextStatus:"conferencia", expectedVersion: 1 } });
  assert.equal(update.status, 200);
  assert.deepEqual(calls.map(([action]) => action), ["list","get","create","status"]);
  assert.ok(calls.every((call) => call[1] === id));
});

test("case endpoints reject illegal fields and cross-site writes before DB", async () => {
  const { request, calls } = setup();
  assert.equal((await request("case-list", { suffix:"&limit=1000" })).status, 422);
  assert.equal((await request("case-create", { method:"POST",
    body: { title:"Caso",service:"AIRE",role:"admin" } })).status, 422);
  assert.equal((await request("case-status", { method:"POST",
    body: { id, nextStatus:"triagem", expectedVersion: 1, approved:true } })).status, 422);
  assert.equal((await request("case-create", { method:"POST",
    headers: { origin:"https://evil.example.test" },
    body: { title:"Caso",service:"AIRE" } })).status, 403);
  assert.equal(calls.length, 0);
});

test("case storage not configured fails closed and conflicts disclose no DB details", async () => {
  const { request: absent } = setup({ casesEnabled: false });
  assert.equal((await absent("case-list")).status, 503);
  const { request } = setup();
  const conflict = await request("case-status", { method:"POST",
    body: { id,nextStatus:"preparado",expectedVersion:0 } });
  assert.equal(conflict.status, 409);
  assert.equal(JSON.stringify(await conflict.json()).includes("Database sensitive detail"), false);
});


test("staff management requires administrator session, same origin and exact payload", async () => {
  const events = [];
  let role = "admin";
  const app = createOperationalHttp({
    allowedOrigin:origin,
    networkIdentity:()=> "synthetic",
    authentication:{login:async()=>({authenticated:false})},
    accounts:{
      getSession:async candidate=>candidate === token ? {id,role,status:"active"} : null,
      revoke:async()=>{},
      listStaff:async actor=>{events.push(["list",actor]);return [{id,role:"admin",status:"active"}];},
      disableStaff:async (actor,target)=>{events.push(["disable",actor,target]);return {id:target,status:"disabled"};},
    },
  });
  const request = (op,{method="GET",body,authenticated=true,headers={}}={})=>
    app(new Request(origin+"/api/operacional?op="+op,{
      method, headers:{
        ...(method==="POST"?{origin,"content-type":"application/json"}:{}),
        ...(authenticated?{cookie}:{}),...headers,
      },
      ...(body===undefined?{}:{body:JSON.stringify(body)}),
    }));
  assert.equal((await request("staff-list",{authenticated:false})).status,401);
  assert.equal((await request("staff-disable",{method:"POST",body:{id},authenticated:false})).status,401);
  role="operator";
  assert.equal((await request("staff-list")).status,403);
  assert.equal((await request("staff-disable",{method:"POST",body:{id}})).status,403);
  role="admin";
  assert.equal((await request("staff-list")).status,200);
  assert.equal((await request("staff-disable",{method:"POST",body:{id,role:"admin"}})).status,422);
  assert.equal((await request("staff-disable",{method:"POST",body:{id},
    headers:{origin:"https://attacker.example.test"}})).status,403);
  const disabled=await request("staff-disable",{method:"POST",body:{id}});
  assert.equal(disabled.status,200);
  assert.equal((await disabled.json()).staff.status,"disabled");
  assert.deepEqual(events,[["list",id],["disable",id,id]]);
});
