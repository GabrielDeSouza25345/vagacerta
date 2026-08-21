PRAGMA foreign_keys=ON;

CREATE TABLE `users` (`id` text PRIMARY KEY NOT NULL, `email` text NOT NULL, `name` text NOT NULL, `phone` text, `role` text DEFAULT 'USER' NOT NULL, `status` text DEFAULT 'ACTIVE' NOT NULL, `email_confirmed_at` integer, `created_at` integer NOT NULL, `updated_at` integer NOT NULL);
CREATE UNIQUE INDEX `idx_users_email` ON `users` (`email`);

CREATE TABLE `profiles` (`id` text PRIMARY KEY NOT NULL, `user_id` text NOT NULL REFERENCES `users`(`id`) ON DELETE cascade, `city` text, `state` text, `profession` text, `objective` text, `desired_roles` text, `experience_summary` text, `education_summary` text, `skills` text, `availability` text, `preferences` text, `onboarding_step` integer DEFAULT 1 NOT NULL, `created_at` integer NOT NULL, `updated_at` integer NOT NULL);
CREATE UNIQUE INDEX `idx_profiles_user_id` ON `profiles` (`user_id`);

CREATE TABLE `resumes` (`id` text PRIMARY KEY NOT NULL, `user_id` text NOT NULL REFERENCES `users`(`id`) ON DELETE cascade, `name` text NOT NULL, `type` text DEFAULT 'MAIN' NOT NULL, `storage_key` text NOT NULL, `mime_type` text NOT NULL, `version` integer DEFAULT 1 NOT NULL, `approved` integer DEFAULT false NOT NULL, `active` integer DEFAULT true NOT NULL, `created_at` integer NOT NULL, `updated_at` integer NOT NULL);
CREATE INDEX `idx_resumes_user_active` ON `resumes` (`user_id`,`active`);

CREATE TABLE `integrations` (`id` text PRIMARY KEY NOT NULL, `user_id` text NOT NULL REFERENCES `users`(`id`) ON DELETE cascade, `platform` text NOT NULL, `status` text DEFAULT 'DISCONNECTED' NOT NULL, `encrypted_session_ref` text, `settings` text, `connected_at` integer, `last_run_at` integer, `created_at` integer NOT NULL, `updated_at` integer NOT NULL);
CREATE UNIQUE INDEX `idx_integrations_user_platform` ON `integrations` (`user_id`,`platform`);

CREATE TABLE `jobs` (`id` text PRIMARY KEY NOT NULL, `user_id` text NOT NULL REFERENCES `users`(`id`) ON DELETE cascade, `external_id` text, `platform` text NOT NULL, `company` text NOT NULL, `title` text NOT NULL, `location` text, `url` text, `match_score` integer, `status` text DEFAULT 'FOUND' NOT NULL, `published_at` integer, `created_at` integer NOT NULL, `updated_at` integer NOT NULL);
CREATE INDEX `idx_jobs_user_status` ON `jobs` (`user_id`,`status`);

CREATE TABLE `applications` (`id` text PRIMARY KEY NOT NULL, `user_id` text NOT NULL REFERENCES `users`(`id`) ON DELETE cascade, `job_id` text REFERENCES `jobs`(`id`) ON DELETE set null, `resume_id` text REFERENCES `resumes`(`id`) ON DELETE set null, `platform` text NOT NULL, `company` text NOT NULL, `role` text NOT NULL, `status` text DEFAULT 'DRAFT' NOT NULL, `external_url` text, `applied_at` integer, `result` text, `created_at` integer NOT NULL, `updated_at` integer NOT NULL);
CREATE INDEX `idx_applications_user_status` ON `applications` (`user_id`,`status`);

CREATE TABLE `automation_jobs` (`id` text PRIMARY KEY NOT NULL, `user_id` text NOT NULL REFERENCES `users`(`id`) ON DELETE cascade, `type` text NOT NULL, `platform` text, `status` text DEFAULT 'QUEUED' NOT NULL, `attempts` integer DEFAULT 0 NOT NULL, `payload` text, `result` text, `error` text, `started_at` integer, `finished_at` integer, `created_at` integer NOT NULL, `updated_at` integer NOT NULL);
CREATE INDEX `idx_automation_jobs_status_created` ON `automation_jobs` (`status`,`created_at`);
CREATE INDEX `idx_automation_jobs_user` ON `automation_jobs` (`user_id`);

CREATE TABLE `activity_logs` (`id` text PRIMARY KEY NOT NULL, `user_id` text NOT NULL REFERENCES `users`(`id`) ON DELETE cascade, `job_id` text REFERENCES `automation_jobs`(`id`) ON DELETE set null, `module` text NOT NULL, `action` text NOT NULL, `status` text NOT NULL, `metadata` text, `created_at` integer NOT NULL);
CREATE INDEX `idx_activity_logs_user_created` ON `activity_logs` (`user_id`,`created_at`);

CREATE TABLE `plans` (`id` text PRIMARY KEY NOT NULL, `name` text NOT NULL, `price_cents` integer DEFAULT 0 NOT NULL, `daily_application_limit` integer NOT NULL, `monthly_application_limit` integer NOT NULL, `resume_limit` integer NOT NULL, `automation_limit` integer NOT NULL, `features` text, `active` integer DEFAULT true NOT NULL, `created_at` integer NOT NULL, `updated_at` integer NOT NULL);

CREATE TABLE `subscriptions` (`id` text PRIMARY KEY NOT NULL, `user_id` text NOT NULL REFERENCES `users`(`id`) ON DELETE cascade, `plan_id` text NOT NULL REFERENCES `plans`(`id`), `status` text NOT NULL, `starts_at` integer NOT NULL, `renews_at` integer, `created_at` integer NOT NULL, `updated_at` integer NOT NULL);
CREATE INDEX `idx_subscriptions_user_status` ON `subscriptions` (`user_id`,`status`);

INSERT INTO `plans` (`id`,`name`,`price_cents`,`daily_application_limit`,`monthly_application_limit`,`resume_limit`,`automation_limit`,`features`,`active`,`created_at`,`updated_at`)
VALUES ('free','FREE',0,5,30,1,1,'["perfil","curriculo_principal","busca_assistida"]',true,unixepoch(),unixepoch());

PRAGMA optimize;
