import { getChatGPTUser } from "../../chatgpt-auth";

function config() { return { url: process.env.BROWSER_WORKER_URL?.replace(/\/$/, ""), token: process.env.BROWSER_WORKER_TOKEN }; }
async function worker(path: string, userId: string, init?: RequestInit) {
  const { url, token } = config();
  if (!url || !token) return Response.json({ error: "Browser worker não configurado" }, { status: 503 });
  const response = await fetch(`${url}${path}`, { ...init, headers: { "content-type": "application/json", authorization: `Bearer ${token}`, "x-authenticated-user-id": userId, ...(init?.headers ?? {}) } });
  return new Response(response.body, { status: response.status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
}
export async function GET() { const user = await getChatGPTUser(); if (!user) return Response.json({ error: "Não autenticado" }, { status: 401 }); return worker("/integrations", user.userId); }
export async function PUT(request: Request) {
  const user = await getChatGPTUser(); if (!user) return Response.json({ error: "Não autenticado" }, { status: 401 });
  const body = await request.json().catch(() => null) as { platform?: string; connected?: boolean } | null;
  if (!body || !["LINKEDIN", "GUPY"].includes(body.platform ?? "") || typeof body.connected !== "boolean") return Response.json({ error: "Dados inválidos" }, { status: 400 });
  return worker("/browser/jobs", user.userId, { method: "POST", body: JSON.stringify({ platform: body.platform, action: body.connected ? "CONNECT_PLATFORM" : "DISCONNECT_PLATFORM" }) });
}
