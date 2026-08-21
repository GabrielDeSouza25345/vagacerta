export async function GET() {
  return Response.json({ status: "ok", service: "vagacerta-web", timestamp: new Date().toISOString() });
}
