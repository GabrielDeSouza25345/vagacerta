import { env } from "cloudflare:workers";
import { desc, eq } from "drizzle-orm";
import { ensurePreviewDatabase, getDb } from "../../../db";
import { resumes, users } from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";

async function context() {
  await ensurePreviewDatabase();
  const user = await getChatGPTUser(); if (!user) return null;
  const db = getDb(); const now = new Date();
  await db.insert(users).values({ id: user.userId, email: user.email, name: user.displayName, createdAt: now, updatedAt: now }).onConflictDoUpdate({ target: users.id, set: { email: user.email, name: user.displayName, updatedAt: now } });
  return { user, db };
}
export async function GET() { const ctx = await context(); if (!ctx) return Response.json({ error: "Não autenticado" }, { status: 401 }); const rows = await ctx.db.select().from(resumes).where(eq(resumes.userId, ctx.user.userId)).orderBy(desc(resumes.createdAt)); return Response.json({ resumes: rows }); }
export async function POST(request: Request) {
  const ctx = await context(); if (!ctx) return Response.json({ error: "Não autenticado" }, { status: 401 });
  const form = await request.formData(); const file = form.get("file"); const name = String(form.get("name") ?? "Currículo principal").trim().slice(0, 120);
  if (!(file instanceof File) || !name) return Response.json({ error: "Selecione um arquivo e informe o nome." }, { status: 400 });
  const allowed = ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
  if (!allowed.includes(file.type) || file.size > 8 * 1024 * 1024) return Response.json({ error: "Use PDF ou Word com no máximo 8 MB." }, { status: 400 });
  const id = crypto.randomUUID(); const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_"); const key = `users/${ctx.user.userId}/resumes/${id}/${safeName}`; const now = new Date();
  await env.FILES.put(key, file.stream(), { httpMetadata: { contentType: file.type } });
  const current = await ctx.db.select().from(resumes).where(eq(resumes.userId, ctx.user.userId));
  const updates = current.filter(row => row.approved).map(row => ctx.db.update(resumes).set({ approved: false, updatedAt: now }).where(eq(resumes.id, row.id)));
  if (updates.length) await ctx.db.batch(updates as [typeof updates[number], ...typeof updates]);
  await ctx.db.insert(resumes).values({ id, userId: ctx.user.userId, name, storageKey: key, mimeType: file.type, version: current.length + 1, approved: true, active: true, createdAt: now, updatedAt: now });
  return Response.json({ ok: true, id }, { status: 201 });
}
