import { getChatGPTUser } from "../../../../chatgpt-auth";
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getChatGPTUser(); if (!user) return Response.json({ error: "Não autenticado" }, { status: 401 });
  const url = process.env.BROWSER_WORKER_URL?.replace(/\/$/, ""), token = process.env.BROWSER_WORKER_TOKEN;
  if (!url || !token) return Response.json({ error: "Browser worker não configurado" }, { status: 503 });
  const { id } = await context.params; const response = await fetch(`${url}/browser/jobs/${encodeURIComponent(id)}`, { headers: { authorization: `Bearer ${token}`, "x-authenticated-user-id": user.userId } });
  return new Response(response.body, { status: response.status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
}
