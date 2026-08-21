import { getChatGPTUser } from "../../chatgpt-auth";

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Não autenticado" }, { status: 401 });
  return Response.json({ id: user.userId, email: user.email, name: user.displayName });
}
