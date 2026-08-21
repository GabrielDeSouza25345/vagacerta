import { and, eq } from "drizzle-orm";
import { ensurePreviewDatabase, getDb } from "../../../../db";
import { applications } from "../../../../db/schema";
import { getChatGPTUser } from "../../../chatgpt-auth";
const statuses = new Set(["DRAFT", "SENT", "IN_REVIEW", "INTERVIEW", "REJECTED"]);
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  await ensurePreviewDatabase();
  const user = await getChatGPTUser(); if (!user) return Response.json({ error: "Não autenticado" }, { status: 401 });
  const body = await request.json().catch(() => null) as { status?: string } | null;
  if (!body?.status || !statuses.has(body.status)) return Response.json({ error: "Status inválido" }, { status: 400 });
  const { id } = await context.params;
  await getDb().update(applications).set({ status: body.status, updatedAt: new Date() }).where(and(eq(applications.id, id), eq(applications.userId, user.userId)));
  return Response.json({ ok: true });
}
