import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { applications } from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Não autenticado" }, { status: 401 });
  const rows = await getDb().select().from(applications).where(eq(applications.userId, user.userId)).orderBy(desc(applications.createdAt)).limit(100);
  return Response.json({ applications: rows });
}
