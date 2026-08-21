import { desc, eq } from "drizzle-orm";
import { ensurePreviewDatabase, getDb } from "../../../db";
import { applications, users } from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";

export async function GET() {
  await ensurePreviewDatabase();
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Não autenticado" }, { status: 401 });
  const rows = await getDb().select().from(applications).where(eq(applications.userId, user.userId)).orderBy(desc(applications.createdAt)).limit(100);
  return Response.json({ applications: rows });
}

export async function POST(request: Request) {
  await ensurePreviewDatabase();
  const user = await getChatGPTUser(); if (!user) return Response.json({ error: "Não autenticado" }, { status: 401 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const company = typeof body?.company === "string" ? body.company.trim().slice(0, 160) : ""; const role = typeof body?.role === "string" ? body.role.trim().slice(0, 160) : "";
  const platform = typeof body?.platform === "string" ? body.platform.trim().slice(0, 30) : "OUTRO"; const externalUrl = typeof body?.externalUrl === "string" && body.externalUrl.trim() ? body.externalUrl.trim().slice(0, 1000) : null;
  if (!company || !role) return Response.json({ error: "Informe empresa e cargo." }, { status: 400 });
  const db = getDb(); const now = new Date(); const id = crypto.randomUUID();
  await db.insert(users).values({ id: user.userId, email: user.email, name: user.displayName, createdAt: now, updatedAt: now }).onConflictDoUpdate({ target: users.id, set: { email: user.email, name: user.displayName, updatedAt: now } });
  await db.insert(applications).values({ id, userId: user.userId, company, role, platform, externalUrl, status: "SENT", appliedAt: now, createdAt: now, updatedAt: now });
  return Response.json({ ok: true, id }, { status: 201 });
}
