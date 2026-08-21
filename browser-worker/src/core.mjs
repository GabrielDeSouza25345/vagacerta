import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export const PLATFORMS = new Set(["LINKEDIN", "GUPY"]);
export const ACTIONS = new Set(["CONNECT_PLATFORM", "VALIDATE_SESSION", "DISCONNECT_PLATFORM", "OPEN_PLATFORM"]);
export const PROFILE_STATUSES = new Set(["CONNECTED", "EXPIRED", "DISCONNECTED", "CONNECTING", "ERROR", "NEEDS_VALIDATION"]);
export const platformUrl = p => p === "LINKEDIN" ? "https://www.linkedin.com/feed/" : "https://portal.gupy.io/my/applications";
export const profileKey = (userId, platform) => `${createHash("sha256").update(userId).digest("hex")}/${platform.toLowerCase()}`;

export class LockManager {
  #locks = new Set();
  async run(key, operation) { if (this.#locks.has(key)) throw new Error("PROFILE_BUSY"); this.#locks.add(key); try { return await operation(); } finally { this.#locks.delete(key); } }
  has(key) { return this.#locks.has(key); }
}

export class StateStore {
  constructor(root, encryptionKey) { this.root = root; this.key = createHash("sha256").update(encryptionKey).digest(); this.file = path.join(root, "state.enc"); this.state = { profiles: {}, jobs: [] }; }
  async load() { await mkdir(this.root, { recursive: true }); try { this.state = JSON.parse(this.decrypt(await readFile(this.file))); } catch (error) { if (error.code !== "ENOENT") throw error; await this.save(); } }
  encrypt(value) { const iv = randomBytes(12); const cipher = createCipheriv("aes-256-gcm", this.key, iv); const body = Buffer.concat([cipher.update(value), cipher.final()]); return Buffer.concat([iv, cipher.getAuthTag(), body]); }
  decrypt(value) { const iv = value.subarray(0, 12), tag = value.subarray(12, 28), body = value.subarray(28); const decipher = createDecipheriv("aes-256-gcm", this.key, iv); decipher.setAuthTag(tag); return Buffer.concat([decipher.update(body), decipher.final()]).toString(); }
  async save() { const temp = `${this.file}.${randomUUID()}.tmp`; await writeFile(temp, this.encrypt(JSON.stringify(this.state))); await rename(temp, this.file); }
  profile(userId, platform) { return this.state.profiles[profileKey(userId, platform)] ?? null; }
  async updateProfile(userId, platform, patch) { const key = profileKey(userId, platform), now = new Date().toISOString(); this.state.profiles[key] = { id: key, userIdHash: key.split("/")[0], platform, status: "NEEDS_VALIDATION", createdAt: now, ...this.state.profiles[key], ...patch, updatedAt: now }; await this.save(); return this.state.profiles[key]; }
  async deleteProfile(userId, platform) { delete this.state.profiles[profileKey(userId, platform)]; await rm(path.join(this.root, "profiles", profileKey(userId, platform)), { recursive: true, force: true }); await this.save(); }
  async addJob({ userId, platform, action }) { const now = new Date().toISOString(); const job = { id: randomUUID(), userId, userIdHash: createHash("sha256").update(userId).digest("hex"), platform, action, status: "QUEUED", attempts: 0, createdAt: now, startedAt: null, finishedAt: null, error: null, result: null }; this.state.jobs.push(job); await this.save(); return job; }
  async patchJob(id, patch) { const job = this.state.jobs.find(item => item.id === id); if (!job) return null; Object.assign(job, patch); await this.save(); return job; }
  job(id, userId) { return this.state.jobs.find(item => item.id === id && item.userId === userId) ?? null; }
  queued() { return this.state.jobs.find(item => item.status === "QUEUED") ?? null; }
}

export function authorize(request, token) { const supplied = request.headers.authorization?.replace(/^Bearer\s+/i, "") ?? ""; const a = Buffer.from(supplied), b = Buffer.from(token); return a.length === b.length && timingSafeEqual(a, b); }
