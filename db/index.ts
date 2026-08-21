import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export function getDb() {
  if (!env.DB) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Set the `d1` field in .openai/hosting.json to `DB` or let your control plane inject the real binding values before using the database."
    );
  }

  return drizzle(env.DB, { schema });
}

export async function ensurePreviewDatabase() {
  if (!import.meta.env.DEV || !env.DB) return;
  const statements = [
    "CREATE TABLE IF NOT EXISTS users (id text PRIMARY KEY NOT NULL, email text NOT NULL, name text NOT NULL, phone text, role text DEFAULT 'USER' NOT NULL, status text DEFAULT 'ACTIVE' NOT NULL, email_confirmed_at integer, created_at integer NOT NULL, updated_at integer NOT NULL)",
    "CREATE TABLE IF NOT EXISTS profiles (id text PRIMARY KEY NOT NULL, user_id text NOT NULL REFERENCES users(id) ON DELETE cascade, city text, state text, profession text, objective text, desired_roles text, experience_summary text, education_summary text, skills text, availability text, preferences text, onboarding_step integer DEFAULT 1 NOT NULL, created_at integer NOT NULL, updated_at integer NOT NULL)",
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id)",
    "CREATE TABLE IF NOT EXISTS resumes (id text PRIMARY KEY NOT NULL, user_id text NOT NULL REFERENCES users(id) ON DELETE cascade, name text NOT NULL, type text DEFAULT 'MAIN' NOT NULL, storage_key text NOT NULL, mime_type text NOT NULL, version integer DEFAULT 1 NOT NULL, approved integer DEFAULT false NOT NULL, active integer DEFAULT true NOT NULL, created_at integer NOT NULL, updated_at integer NOT NULL)",
    "CREATE TABLE IF NOT EXISTS applications (id text PRIMARY KEY NOT NULL, user_id text NOT NULL REFERENCES users(id) ON DELETE cascade, job_id text, resume_id text, platform text NOT NULL, company text NOT NULL, role text NOT NULL, status text DEFAULT 'DRAFT' NOT NULL, external_url text, applied_at integer, result text, created_at integer NOT NULL, updated_at integer NOT NULL)",
    "CREATE TABLE IF NOT EXISTS integrations (id text PRIMARY KEY NOT NULL, user_id text NOT NULL REFERENCES users(id) ON DELETE cascade, platform text NOT NULL, status text DEFAULT 'DISCONNECTED' NOT NULL, encrypted_session_ref text, settings text, connected_at integer, last_run_at integer, created_at integer NOT NULL, updated_at integer NOT NULL)",
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_integrations_user_platform ON integrations(user_id, platform)",
  ];
  await env.DB.batch(statements.map(sql => env.DB.prepare(sql)));
}
