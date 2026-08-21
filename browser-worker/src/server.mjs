import http from "node:http";
import net from "node:net";
import path from "node:path";
import { createHash, randomBytes } from "node:crypto";
import { readFile, rm } from "node:fs/promises";
import { chromium } from "playwright";
import { WebSocket, WebSocketServer } from "ws";
import { ACTIONS, authorize, LockManager, platformUrl, PLATFORMS, profileKey, StateStore } from "./core.mjs";

const config = {
  port: Number(process.env.PORT ?? 8080),
  dataRoot: process.env.DATA_DIR ?? process.env.BROWSER_DATA_ROOT ?? "/data",
  token: process.env.BROWSER_WORKER_TOKEN,
  encryptionKey: process.env.BROWSER_PROFILE_ENCRYPTION_KEY,
  maxWorkers: Number(process.env.MAX_BROWSER_WORKERS ?? 1),
  interactiveBaseUrl: process.env.INTERACTIVE_BROWSER_BASE_URL ?? (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : null),
  interactiveTtl: Number(process.env.INTERACTIVE_SESSION_TTL ?? 600) * 1000,
  maxJobsPerUser: Number(process.env.MAX_BROWSER_JOBS_PER_USER ?? 2),
  betaMode: process.env.BETA_MODE === "true",
  betaMaxUsers: Number(process.env.BETA_MAX_USERS ?? 6),
};
if (!config.token || !config.encryptionKey) throw new Error("BROWSER_WORKER_TOKEN and BROWSER_PROFILE_ENCRYPTION_KEY are required");

const store = new StateStore(config.dataRoot, config.encryptionKey);
await store.load();
const locks = new LockManager();
const sessions = new Map();
const sessionOutcomes = new Map();
let activeJobs = 0;
const startedAt = Date.now();
const noVncRoot = "/usr/share/novnc";

for (const job of store.state.jobs.filter(item => ["RUNNING", "ACTION_REQUIRED"].includes(item.status))) {
  await store.patchJob(job.id, { status: "FAILED", finishedAt: new Date().toISOString(), error: "SESSION_INTERRUPTED_BY_RESTART" });
  const profile = store.profile(job.userId, job.platform);
  if (profile?.status === "CONNECTING") await store.updateProfile(job.userId, job.platform, { status: "EXPIRED" });
}

async function validate(page, platform) {
  const url = page.url();
  if (/login|signin|checkpoint|challenge/i.test(url)) return { authenticated: false, status: /checkpoint|challenge/i.test(url) ? "ACTION_REQUIRED" : "EXPIRED" };
  if (platform === "LINKEDIN") return { authenticated: await page.locator('nav[aria-label], a[href*="/feed/"]').first().isVisible().catch(() => false), status: "CONNECTED" };
  return { authenticated: await page.locator('a[href*="applications"], [data-testid*="profile"]').first().isVisible().catch(() => false), status: "CONNECTED" };
}

function publicBase(job) {
  const value = config.interactiveBaseUrl ?? job.publicBaseUrl;
  if (!value || !/^https:\/\//i.test(value)) throw new Error("INTERACTIVE_BROWSER_BASE_URL_REQUIRED");
  return value.replace(/\/$/, "");
}

function tokenHash(token) { return createHash("sha256").update(token).digest("hex"); }
function findSession(token) {
  const session = sessions.get(tokenHash(token));
  return session && session.expiresAt > Date.now() ? session : null;
}

async function closeSession(session, outcome = "EXPIRED") {
  if (!session || session.closed) return;
  session.closed = true;
  clearInterval(session.validationTimer);
  clearTimeout(session.expiryTimer);
  sessions.delete(session.tokenHash);
  sessionOutcomes.set(session.tokenHash, { status: outcome === "CONNECTED" ? "CONNECTED" : "EXPIRED", expiresAt: Date.now() + 60000 });
  setTimeout(() => sessionOutcomes.delete(session.tokenHash), 60000).unref();
  for (const socket of session.sockets) socket.close(1000, outcome === "CONNECTED" ? "connected" : "session_closed");
  await session.context.close().catch(() => {});
  if (outcome === "CONNECTED") {
    await store.updateProfile(session.userId, session.platform, { status: "CONNECTED", connectedAt: new Date().toISOString(), lastValidatedAt: new Date().toISOString(), lastUsedAt: new Date().toISOString() });
    await store.patchJob(session.jobId, { status: "SUCCEEDED", finishedAt: new Date().toISOString(), result: { status: "CONNECTED" } });
  } else if (outcome === "DISCONNECTED") {
    await store.patchJob(session.jobId, { status: "FAILED", finishedAt: new Date().toISOString(), error: "SESSION_CANCELLED" });
  } else {
    await store.updateProfile(session.userId, session.platform, { status: "EXPIRED" });
    await store.patchJob(session.jobId, { status: "FAILED", finishedAt: new Date().toISOString(), error: "SESSION_EXPIRED" });
  }
}

async function createInteractiveSession({ job, context, page }) {
  const token = randomBytes(32).toString("base64url");
  const hashed = tokenHash(token);
  const interactiveUrl = `${publicBase(job)}/session/${encodeURIComponent(token)}`;
  const session = { tokenHash: hashed, userId: job.userId, platform: job.platform, jobId: job.id, context, page, expiresAt: Date.now() + config.interactiveTtl, sockets: new Set(), closed: false, validationTimer: null, expiryTimer: null };
  sessions.set(hashed, session);
  session.expiryTimer = setTimeout(() => closeSession(session, "EXPIRED").catch(console.error), config.interactiveTtl);
  session.validationTimer = setInterval(async () => {
    if (session.closed) return;
    const result = await validate(page, job.platform).catch(() => ({ authenticated: false }));
    if (result.authenticated) await closeSession(session, "CONNECTED");
  }, 2000);
  session.validationTimer.unref();
  session.expiryTimer.unref();
  return interactiveUrl;
}

async function execute(job) {
  const lockKey = `${job.userId}:${job.platform}`;
  return locks.run(lockKey, async () => {
    activeJobs++;
    let context;
    let keepContext = false;
    try {
      await store.patchJob(job.id, { status: "RUNNING", attempts: job.attempts + 1, startedAt: new Date().toISOString() });
      const previous = [...sessions.values()].find(item => item.userId === job.userId && item.platform === job.platform);
      if (previous) await closeSession(previous, job.action === "DISCONNECT_PLATFORM" ? "DISCONNECTED" : "EXPIRED");
      if (job.action === "DISCONNECT_PLATFORM") {
        await store.deleteProfile(job.userId, job.platform);
        return store.patchJob(job.id, { status: "SUCCEEDED", finishedAt: new Date().toISOString(), result: { status: "DISCONNECTED" } });
      }
      await store.updateProfile(job.userId, job.platform, { status: job.action === "CONNECT_PLATFORM" ? "CONNECTING" : "NEEDS_VALIDATION", storagePath: profileKey(job.userId, job.platform) });
      const profileDir = path.join(config.dataRoot, "profiles", profileKey(job.userId, job.platform));
      for (const staleLock of ["SingletonLock", "SingletonSocket", "SingletonCookie"]) await rm(path.join(profileDir, staleLock), { force: true, recursive: true }).catch(() => {});
      context = await chromium.launchPersistentContext(profileDir, { headless: job.action !== "CONNECT_PLATFORM", viewport: { width: 1280, height: 800 }, args: ["--no-first-run", "--disable-dev-shm-usage"] });
      const page = context.pages()[0] ?? await context.newPage();
      await page.goto(platformUrl(job.platform), { waitUntil: "domcontentloaded", timeout: 60000 });
      const validation = await validate(page, job.platform);
      if (job.action === "CONNECT_PLATFORM" && !validation.authenticated) {
        const interactiveUrl = await createInteractiveSession({ job, context, page });
        keepContext = true;
        await store.updateProfile(job.userId, job.platform, { status: "CONNECTING", lastUsedAt: new Date().toISOString() });
        return store.patchJob(job.id, { status: "ACTION_REQUIRED", result: { status: "CONNECTING", interactiveUrl, reason: "LOGIN_OR_MFA_REQUIRED" } });
      }
      const status = validation.authenticated ? "CONNECTED" : validation.status;
      await store.updateProfile(job.userId, job.platform, { status, lastValidatedAt: new Date().toISOString(), lastUsedAt: new Date().toISOString() });
      return store.patchJob(job.id, { status: "SUCCEEDED", finishedAt: new Date().toISOString(), result: { status } });
    } catch (error) {
      await store.updateProfile(job.userId, job.platform, { status: "ERROR" });
      return store.patchJob(job.id, { status: "FAILED", finishedAt: new Date().toISOString(), error: String(error.message).replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]").slice(0, 500) });
    } finally {
      if (!keepContext) await context?.close().catch(() => {});
      activeJobs--;
    }
  });
}

setInterval(() => {
  if (activeJobs >= config.maxWorkers) return;
  const job = store.queued();
  if (!job || (sessions.size >= config.maxWorkers && job.action !== "DISCONNECT_PLATFORM")) return;
  execute(job).catch(console.error);
}, 300).unref();

function json(response, status, body) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" });
  response.end(JSON.stringify(body));
}

function sessionPage(token, platform) {
  const safeToken = JSON.stringify(token);
  const safePlatform = platform === "LINKEDIN" ? "LinkedIn" : "Gupy";
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><title>Login ${safePlatform}</title><style>html,body,#screen{margin:0;width:100%;height:100%;overflow:hidden;background:#111827}#bar{position:fixed;z-index:2;top:0;left:0;right:0;height:48px;background:#fff;display:flex;align-items:center;gap:12px;padding:0 18px;font:600 14px system-ui;color:#172033;box-shadow:0 2px 10px #0004}#screen{padding-top:48px;box-sizing:border-box}#done{margin-left:auto;border:0;border-radius:8px;background:#166534;color:white;padding:9px 14px;font-weight:700}#status{font-weight:500;color:#526079}</style></head><body><div id="bar"><strong>Login ${safePlatform}</strong><span id="status">Faça seu login nesta janela. A conexão será reconhecida automaticamente.</span><button id="done">Verificar agora</button></div><div id="screen"></div><script type="module">import RFB from "/novnc/core/rfb.js";const token=${safeToken};const proto=location.protocol==="https:"?"wss":"ws";const rfb=new RFB(document.getElementById("screen"),proto+"://"+location.host+"/session/ws/"+encodeURIComponent(token));rfb.scaleViewport=true;rfb.resizeSession=false;rfb.addEventListener("connect",()=>document.getElementById("status").textContent="Janela segura conectada. Faça seu login normalmente.");rfb.addEventListener("disconnect",()=>check());async function check(){const response=await fetch("/session/status/"+encodeURIComponent(token),{cache:"no-store"});const data=await response.json().catch(()=>({}));if(data.status==="CONNECTED"){document.getElementById("status").textContent="Conectado com sucesso. Você já pode fechar esta janela.";document.getElementById("done").textContent="Fechar";document.getElementById("done").onclick=()=>window.close();return true}if(data.status==="EXPIRED"){document.getElementById("status").textContent="O acesso expirou. Volte ao VagaCerta e clique em Reconectar.";return true}return false}document.getElementById("done").onclick=check;setInterval(check,2000);</script></body></html>`;
}

const mime = { ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2" };
const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  if (url.pathname === "/health/browser-worker") {
    const profiles = Object.values(store.state.profiles);
    return json(response, 200, { status: "ok", worker: "online", workersAvailable: Math.max(0, config.maxWorkers - activeJobs - sessions.size), activeBrowserSessions: sessions.size, activeJobs, queuedJobs: store.state.jobs.filter(job => job.status === "QUEUED").length, connectedProfiles: profiles.filter(profile => profile.status === "CONNECTED").length, expiredProfiles: profiles.filter(profile => profile.status === "EXPIRED").length, visualSessionsEnabled: true, workerUptime: Math.floor((Date.now() - startedAt) / 1000) });
  }
  const pageMatch = url.pathname.match(/^\/session\/([^/]+)$/);
  if (request.method === "GET" && pageMatch) {
    const token = decodeURIComponent(pageMatch[1]);
    const session = findSession(token);
    if (!session) return json(response, 410, { error: "session_expired" });
    response.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "referrer-policy": "no-referrer", "content-security-policy": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self' wss:; img-src 'self' data:; frame-ancestors 'none'", "x-frame-options": "DENY", "x-content-type-options": "nosniff" });
    return response.end(sessionPage(token, session.platform));
  }
  const statusMatch = url.pathname.match(/^\/session\/status\/([^/]+)$/);
  if (request.method === "GET" && statusMatch) {
    const token = decodeURIComponent(statusMatch[1]);
    const session = findSession(token);
    if (session) return json(response, 200, { status: "CONNECTING", expiresAt: new Date(session.expiresAt).toISOString() });
    return json(response, 200, { status: sessionOutcomes.get(tokenHash(token))?.status ?? "EXPIRED" });
  }
  if (request.method === "GET" && url.pathname.startsWith("/novnc/")) {
    const relative = url.pathname.slice("/novnc/".length);
    const file = path.resolve(noVncRoot, relative);
    if (!file.startsWith(`${path.resolve(noVncRoot)}${path.sep}`)) return json(response, 404, { error: "not_found" });
    try { const body = await readFile(file); response.writeHead(200, { "content-type": mime[path.extname(file)] ?? "application/octet-stream", "cache-control": "public, max-age=86400", "x-content-type-options": "nosniff" }); return response.end(body); } catch { return json(response, 404, { error: "not_found" }); }
  }
  if (!authorize(request, config.token)) return json(response, 401, { error: "unauthorized" });
  const userId = request.headers["x-authenticated-user-id"];
  if (!userId || Array.isArray(userId)) return json(response, 401, { error: "missing_identity" });
  if (request.method === "POST" && url.pathname === "/browser/jobs") {
    let raw = ""; for await (const chunk of request) raw += chunk;
    const body = JSON.parse(raw || "{}");
    if (!PLATFORMS.has(body.platform) || !ACTIONS.has(body.action)) return json(response, 400, { error: "invalid_job" });
    const userHash = profileKey(userId, "LINKEDIN").split("/")[0];
    const userJobs = store.state.jobs.filter(job => job.userIdHash === userHash && ["QUEUED", "RUNNING", "ACTION_REQUIRED"].includes(job.status)).length;
    if (userJobs >= config.maxJobsPerUser) return json(response, 429, { error: "user_job_limit" });
    const knownUsers = new Set(store.state.jobs.map(job => job.userIdHash));
    if (config.betaMode && !knownUsers.has(userHash) && knownUsers.size >= config.betaMaxUsers) return json(response, 403, { error: "beta_user_limit" });
    const forwardedProto = String(request.headers["x-forwarded-proto"] ?? "https").split(",")[0];
    const forwardedHost = String(request.headers["x-forwarded-host"] ?? request.headers.host ?? "").split(",")[0];
    const publicBaseUrl = forwardedHost ? `${forwardedProto}://${forwardedHost}` : null;
    const job = await store.addJob({ userId, platform: body.platform, action: body.action });
    job.publicBaseUrl = publicBaseUrl;
    await store.save();
    return json(response, 202, { job });
  }
  const match = url.pathname.match(/^\/browser\/jobs\/([^/]+)$/);
  if (request.method === "GET" && match) { const job = store.job(match[1], userId); return job ? json(response, 200, { job }) : json(response, 404, { error: "not_found" }); }
  if (request.method === "GET" && url.pathname === "/integrations") return json(response, 200, { integrations: ["LINKEDIN", "GUPY"].map(platform => store.profile(userId, platform) ?? { platform, status: "DISCONNECTED" }) });
  return json(response, 404, { error: "not_found" });
});

const webSocketServer = new WebSocketServer({ noServer: true, handleProtocols: protocols => protocols.has("binary") ? "binary" : false });
server.on("upgrade", (request, socket, head) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const match = url.pathname.match(/^\/session\/ws\/([^/]+)$/);
  const session = match ? findSession(decodeURIComponent(match[1])) : null;
  if (!session) { socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n"); return socket.destroy(); }
  webSocketServer.handleUpgrade(request, socket, head, webSocket => {
    const vnc = net.createConnection({ host: "127.0.0.1", port: 5900 });
    session.sockets.add(webSocket);
    webSocket.on("message", data => { if (!vnc.destroyed) vnc.write(data); });
    vnc.on("data", data => { if (webSocket.readyState === WebSocket.OPEN) webSocket.send(data, { binary: true }); });
    const close = () => { session.sockets.delete(webSocket); if (!vnc.destroyed) vnc.destroy(); if (webSocket.readyState === WebSocket.OPEN) webSocket.close(); };
    webSocket.on("close", close); webSocket.on("error", close); vnc.on("close", close); vnc.on("error", close);
  });
});

server.listen(config.port, () => console.log(JSON.stringify({ event: "browser_worker_started", port: config.port, visualSessions: true })));

