import { and, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { integrations, users } from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";

async function context() {
  const user = await getChatGPTUser(); if (!user) return null;
  const db = getDb(); const now = new Date();
  await db.insert(users).values({ id: user.userId, email: user.email, name: user.displayName, createdAt: now, updatedAt: now }).onConflictDoUpdate({ target: users.id, set: { email: user.email, name: user.displayName, updatedAt: now } });
  return { user, db };
}

export async function GET() {
  const ctx = await context(); if (!ctx) return Response.json({ error: "Não autenticado" }, { status: 401 });
  const rows = await ctx.db.select().from(integrations).where(eq(integrations.userId, ctx.user.userId));
  return Response.json({ integrations: rows });
}

export async function PUT(request: Request) {
  const ctx = await context(); if (!ctx) return Response.json({ error: "Não autenticado" }, { status: 401 });
  const body = await request.json().catch(() => null) as { platform?: string; connected?: boolean } | null;
  if (!body || !["LINKEDIN", "GUPY"].includes(body.platform ?? "") || typeof body.connected !== "boolean") return Response.json({ error: "Dados inválidos" }, { status: 400 });
  const platform = body.platform as "LINKEDIN" | "GUPY"; const now = new Date();
  const [existing] = await ctx.db.select().from(integrations).where(and(eq(integrations.userId, ctx.user.userId), eq(integrations.platform, platform))).limit(1);
  if (existing) await ctx.db.update(integrations).set({ status: body.connected ? "CONNECTED" : "DISCONNECTED", connectedAt: body.connected ? now : null, updatedAt: now }).where(and(eq(integrations.id, existing.id), eq(integrations.userId, ctx.user.userId)));
  else await ctx.db.insert(integrations).values({ id: crypto.randomUUID(), userId: ctx.user.userId, platform, status: body.connected ? "CONNECTED" : "DISCONNECTED", connectedAt: body.connected ? now : null, createdAt: now, updatedAt: now });
  return Response.json({ ok: true, platform, status: body.connected ? "CONNECTED" : "DISCONNECTED" });
}
