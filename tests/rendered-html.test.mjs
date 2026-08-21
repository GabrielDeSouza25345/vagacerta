import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("dashboard exposes the core assisted application flow", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /Perfil profissional/);
  assert.match(page, /Currículo aprovado/);
  assert.match(page, /LinkedIn \+ Gupy/);
  assert.match(page, /Buscar vagas compatíveis/);
  assert.match(page, /Seu ambiente é individual/);
});

test("every user-owned table includes userId", async () => {
  const schema = await readFile(new URL("../db/schema.ts", import.meta.url), "utf8");
  for (const table of ["profiles", "resumes", "integrations", "jobs", "applications", "automationJobs", "activityLogs", "subscriptions"]) {
    const start = schema.indexOf(`export const ${table}`);
    assert.ok(start >= 0, `${table} missing`);
    const nextTable = schema.indexOf("export const ", start + 13);
    const block = schema.slice(start, nextTable < 0 ? undefined : nextTable);
    assert.match(block, /userId:\s*text\("user_id"\)\.notNull\(\)/, `${table} must be user-scoped`);
  }
});

test("profile and application APIs derive identity from the authenticated session", async () => {
  const profile = await readFile(new URL("../app/api/profile/route.ts", import.meta.url), "utf8");
  const applications = await readFile(new URL("../app/api/applications/route.ts", import.meta.url), "utf8");
  assert.match(profile, /getChatGPTUser/);
  assert.match(applications, /getChatGPTUser/);
  assert.doesNotMatch(profile, /body\.user_id|body\.userId/);
  assert.doesNotMatch(applications, /searchParams.*user/i);
});

test("integration confirmation is persisted and user-scoped", async () => {
  const route = await readFile(new URL("../app/api/integrations/route.ts", import.meta.url), "utf8");
  const client = await readFile(new URL("../app/dashboard-client.tsx", import.meta.url), "utf8");
  assert.match(route, /getChatGPTUser/);
  assert.match(route, /"x-authenticated-user-id": userId/);
  assert.doesNotMatch(route, /body\.user_id|body\.userId/);
  assert.match(client, /Conectar \/ validar/);
  assert.match(client, /\/api\/integrations/);
});
