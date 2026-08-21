import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { profiles, users } from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";

const allowedFields = ["city", "state", "profession", "objective", "desiredRoles", "experienceSummary", "educationSummary", "skills", "availability", "preferences"] as const;

async function identity() {
  const user = await getChatGPTUser();
  if (!user) return null;
  const db = getDb();
  const now = new Date();
  await db.insert(users).values({ id: user.userId, email: user.email, name: user.displayName, createdAt: now, updatedAt: now }).onConflictDoUpdate({ target: users.id, set: { email: user.email, name: user.displayName, updatedAt: now } });
  return { user, db };
}

export async function GET() {
  const context = await identity();
  if (!context) return Response.json({ error: "Não autenticado" }, { status: 401 });
  const [profile] = await context.db.select().from(profiles).where(eq(profiles.userId, context.user.userId)).limit(1);
  return Response.json({ profile: profile ?? null });
}

export async function PUT(request: Request) {
  const context = await identity();
  if (!context) return Response.json({ error: "Não autenticado" }, { status: 401 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return Response.json({ error: "Corpo inválido" }, { status: 400 });
  const values: Record<string, string | null> = {};
  for (const key of allowedFields) {
    const value = body[key];
    if (value !== undefined && value !== null && typeof value !== "string") return Response.json({ error: `Campo inválido: ${key}` }, { status: 400 });
    if (value !== undefined) values[key] = value === null ? null : value.trim().slice(0, 5000);
  }
  const now = new Date();
  await context.db.insert(profiles).values({ id: crypto.randomUUID(), userId: context.user.userId, ...values, createdAt: now, updatedAt: now })
    .onConflictDoUpdate({ target: profiles.userId, set: { ...values, updatedAt: now } });
  return Response.json({ ok: true });
}
