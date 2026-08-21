import http from "node:http";
import path from "node:path";
import { chromium } from "playwright";
import { ACTIONS, authorize, LockManager, platformUrl, PLATFORMS, profileKey, StateStore } from "./core.mjs";

const config = {
  port: Number(process.env.PORT ?? 8080), dataRoot: process.env.DATA_DIR ?? process.env.BROWSER_DATA_ROOT ?? "/data",
  token: process.env.BROWSER_WORKER_TOKEN, encryptionKey: process.env.BROWSER_PROFILE_ENCRYPTION_KEY,
  timeout: Number(process.env.BROWSER_JOB_TIMEOUT ?? 300000), maxWorkers: Number(process.env.MAX_BROWSER_WORKERS ?? 1),
  interactiveBaseUrl: process.env.INTERACTIVE_BROWSER_BASE_URL ?? null,
  maxJobsPerUser: Number(process.env.MAX_BROWSER_JOBS_PER_USER ?? 2), betaMode: process.env.BETA_MODE === "true", betaMaxUsers: Number(process.env.BETA_MAX_USERS ?? 6),
};
if (!config.token || !config.encryptionKey) throw new Error("BROWSER_WORKER_TOKEN and BROWSER_PROFILE_ENCRYPTION_KEY are required");
const store = new StateStore(config.dataRoot, config.encryptionKey); await store.load(); const locks = new LockManager(); let activeJobs = 0;
const startedAt = Date.now();

async function validate(page, platform) {
  const url = page.url();
  if (/login|signin|checkpoint|challenge/i.test(url)) return { authenticated: false, status: /checkpoint|challenge/i.test(url) ? "ACTION_REQUIRED" : "EXPIRED" };
  if (platform === "LINKEDIN") return { authenticated: await page.locator('nav[aria-label], a[href*="/feed/"]').first().isVisible().catch(() => false), status: "CONNECTED" };
  return { authenticated: await page.locator('a[href*="applications"], [data-testid*="profile"]').first().isVisible().catch(() => false), status: "CONNECTED" };
}

async function execute(job) {
  const lockKey = `${job.userId}:${job.platform}`;
  return locks.run(lockKey, async () => {
    activeJobs++; const startedAt = new Date().toISOString(); await store.patchJob(job.id, { status: "RUNNING", attempts: job.attempts + 1, startedAt });
    const profileDir = path.join(config.dataRoot, "profiles", profileKey(job.userId, job.platform)); let context;
    try {
      if (job.action === "DISCONNECT_PLATFORM") { await store.deleteProfile(job.userId, job.platform); return store.patchJob(job.id, { status: "SUCCEEDED", finishedAt: new Date().toISOString(), result: { status: "DISCONNECTED" } }); }
      await store.updateProfile(job.userId, job.platform, { status: job.action === "CONNECT_PLATFORM" ? "CONNECTING" : "NEEDS_VALIDATION", storagePath: profileKey(job.userId, job.platform) });
      context = await chromium.launchPersistentContext(profileDir, { headless: job.action !== "CONNECT_PLATFORM", viewport: { width: 1280, height: 800 } });
      const page = context.pages()[0] ?? await context.newPage(); await page.goto(platformUrl(job.platform), { waitUntil: "domcontentloaded", timeout: 60000 });
      let validation = await validate(page, job.platform);
      if (job.action === "CONNECT_PLATFORM" && !validation.authenticated) {
        const actionToken = crypto.randomUUID(); const interactiveUrl = config.interactiveBaseUrl ? `${config.interactiveBaseUrl.replace(/\/$/, "")}/?token=${actionToken}` : null;
        await store.updateProfile(job.userId, job.platform, { status: "CONNECTING", lastUsedAt: new Date().toISOString() });
        return store.patchJob(job.id, { status: "ACTION_REQUIRED", finishedAt: new Date().toISOString(), result: { status: "CONNECTING", interactiveUrl, reason: "LOGIN_OR_MFA_REQUIRED" } });
      }
      const status = validation.authenticated ? "CONNECTED" : validation.status; await store.updateProfile(job.userId, job.platform, { status, lastValidatedAt: new Date().toISOString(), lastUsedAt: new Date().toISOString() });
      return store.patchJob(job.id, { status: "SUCCEEDED", finishedAt: new Date().toISOString(), result: { status } });
    } catch (error) { await store.updateProfile(job.userId, job.platform, { status: "ERROR" }); return store.patchJob(job.id, { status: "FAILED", finishedAt: new Date().toISOString(), error: String(error.message).replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]").slice(0, 500) }); }
    finally { await context?.close().catch(() => {}); activeJobs--; }
  });
}

setInterval(async () => { if (activeJobs >= config.maxWorkers) return; const job = store.queued(); if (job) execute(job); }, 300).unref();
function json(response, status, body) { response.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" }); response.end(JSON.stringify(body)); }
const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  if (url.pathname === "/health/browser-worker") { const profiles=Object.values(store.state.profiles); return json(response, 200, { status: "ok", worker: "online", workersAvailable: Math.max(0, config.maxWorkers - activeJobs), activeBrowserSessions: activeJobs, activeJobs, queuedJobs: store.state.jobs.filter(j => j.status === "QUEUED").length, connectedProfiles: profiles.filter(p => p.status === "CONNECTED").length, expiredProfiles: profiles.filter(p => p.status === "EXPIRED").length, workerUptime: Math.floor((Date.now()-startedAt)/1000) }); }
  if (!authorize(request, config.token)) return json(response, 401, { error: "unauthorized" });
  const userId = request.headers["x-authenticated-user-id"]; if (!userId || Array.isArray(userId)) return json(response, 401, { error: "missing_identity" });
  if (request.method === "POST" && url.pathname === "/browser/jobs") { let raw=""; for await (const chunk of request) raw += chunk; const body=JSON.parse(raw||"{}"); if(!PLATFORMS.has(body.platform)||!ACTIONS.has(body.action)) return json(response,400,{error:"invalid_job"}); const userHash=profileKey(userId,"LINKEDIN").split("/")[0]; const userJobs=store.state.jobs.filter(j=>j.userIdHash===userHash&&["QUEUED","RUNNING","ACTION_REQUIRED"].includes(j.status)).length; if(userJobs>=config.maxJobsPerUser)return json(response,429,{error:"user_job_limit"}); const knownUsers=new Set(store.state.jobs.map(j=>j.userIdHash)); if(config.betaMode&&!knownUsers.has(userHash)&&knownUsers.size>=config.betaMaxUsers)return json(response,403,{error:"beta_user_limit"}); const job=await store.addJob({userId,platform:body.platform,action:body.action}); return json(response,202,{job}); }
  const match=url.pathname.match(/^\/browser\/jobs\/([^/]+)$/); if(request.method==="GET"&&match){const job=store.job(match[1],userId);return job?json(response,200,{job}):json(response,404,{error:"not_found"});}
  if(request.method==="GET"&&url.pathname==="/integrations"){return json(response,200,{integrations:["LINKEDIN","GUPY"].map(platform=>store.profile(userId,platform)??{platform,status:"DISCONNECTED"})});}
  return json(response,404,{error:"not_found"});
}); server.listen(config.port, () => console.log(JSON.stringify({ event: "browser_worker_started", port: config.port })));
