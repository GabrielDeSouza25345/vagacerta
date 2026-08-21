import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
};

export const users = sqliteTable("users", {
  id: text("id").primaryKey(), email: text("email").notNull(), name: text("name").notNull(), phone: text("phone"),
  role: text("role", { enum: ["USER", "ADMIN", "SUPPORT"] }).notNull().default("USER"),
  status: text("status", { enum: ["ACTIVE", "PENDING", "SUSPENDED", "DELETED"] }).notNull().default("ACTIVE"),
  emailConfirmedAt: integer("email_confirmed_at", { mode: "timestamp" }), ...timestamps,
}, (table) => [uniqueIndex("idx_users_email").on(table.email)]);

export const profiles = sqliteTable("profiles", {
  id: text("id").primaryKey(), userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  city: text("city"), state: text("state"), profession: text("profession"), objective: text("objective"),
  desiredRoles: text("desired_roles"), experienceSummary: text("experience_summary"), educationSummary: text("education_summary"),
  skills: text("skills"), availability: text("availability"), preferences: text("preferences"),
  onboardingStep: integer("onboarding_step").notNull().default(1), ...timestamps,
}, (table) => [uniqueIndex("idx_profiles_user_id").on(table.userId)]);

export const resumes = sqliteTable("resumes", {
  id: text("id").primaryKey(), userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(), type: text("type").notNull().default("MAIN"), storageKey: text("storage_key").notNull(),
  mimeType: text("mime_type").notNull(), version: integer("version").notNull().default(1),
  approved: integer("approved", { mode: "boolean" }).notNull().default(false), active: integer("active", { mode: "boolean" }).notNull().default(true), ...timestamps,
}, (table) => [index("idx_resumes_user_active").on(table.userId, table.active)]);

export const integrations = sqliteTable("integrations", {
  id: text("id").primaryKey(), userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  platform: text("platform", { enum: ["LINKEDIN", "GUPY"] }).notNull(),
  status: text("status", { enum: ["DISCONNECTED", "ACTION_REQUIRED", "CONNECTED", "ERROR"] }).notNull().default("DISCONNECTED"),
  encryptedSessionRef: text("encrypted_session_ref"), settings: text("settings"), connectedAt: integer("connected_at", { mode: "timestamp" }),
  lastRunAt: integer("last_run_at", { mode: "timestamp" }), ...timestamps,
}, (table) => [uniqueIndex("idx_integrations_user_platform").on(table.userId, table.platform)]);

export const jobs = sqliteTable("jobs", {
  id: text("id").primaryKey(), userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  externalId: text("external_id"), platform: text("platform").notNull(), company: text("company").notNull(), title: text("title").notNull(),
  location: text("location"), url: text("url"), matchScore: integer("match_score"), status: text("status").notNull().default("FOUND"),
  publishedAt: integer("published_at", { mode: "timestamp" }), ...timestamps,
}, (table) => [index("idx_jobs_user_status").on(table.userId, table.status)]);

export const applications = sqliteTable("applications", {
  id: text("id").primaryKey(), userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  jobId: text("job_id").references(() => jobs.id, { onDelete: "set null" }), resumeId: text("resume_id").references(() => resumes.id, { onDelete: "set null" }),
  platform: text("platform").notNull(), company: text("company").notNull(), role: text("role").notNull(), status: text("status").notNull().default("DRAFT"),
  externalUrl: text("external_url"), appliedAt: integer("applied_at", { mode: "timestamp" }), result: text("result"), ...timestamps,
}, (table) => [index("idx_applications_user_status").on(table.userId, table.status)]);

export const automationJobs = sqliteTable("automation_jobs", {
  id: text("id").primaryKey(), userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(), platform: text("platform"), status: text("status").notNull().default("QUEUED"), attempts: integer("attempts").notNull().default(0),
  payload: text("payload"), result: text("result"), error: text("error"), startedAt: integer("started_at", { mode: "timestamp" }), finishedAt: integer("finished_at", { mode: "timestamp" }), ...timestamps,
}, (table) => [index("idx_automation_jobs_status_created").on(table.status, table.createdAt), index("idx_automation_jobs_user").on(table.userId)]);

export const activityLogs = sqliteTable("activity_logs", {
  id: text("id").primaryKey(), userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  jobId: text("job_id").references(() => automationJobs.id, { onDelete: "set null" }), module: text("module").notNull(), action: text("action").notNull(),
  status: text("status").notNull(), metadata: text("metadata"), createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
}, (table) => [index("idx_activity_logs_user_created").on(table.userId, table.createdAt)]);

export const plans = sqliteTable("plans", {
  id: text("id").primaryKey(), name: text("name").notNull(), priceCents: integer("price_cents").notNull().default(0),
  dailyApplicationLimit: integer("daily_application_limit").notNull(), monthlyApplicationLimit: integer("monthly_application_limit").notNull(),
  resumeLimit: integer("resume_limit").notNull(), automationLimit: integer("automation_limit").notNull(), features: text("features"),
  active: integer("active", { mode: "boolean" }).notNull().default(true), ...timestamps,
});

export const subscriptions = sqliteTable("subscriptions", {
  id: text("id").primaryKey(), userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  planId: text("plan_id").notNull().references(() => plans.id), status: text("status").notNull(), startsAt: integer("starts_at", { mode: "timestamp" }).notNull(),
  renewsAt: integer("renews_at", { mode: "timestamp" }), ...timestamps,
}, (table) => [index("idx_subscriptions_user_status").on(table.userId, table.status)]);
