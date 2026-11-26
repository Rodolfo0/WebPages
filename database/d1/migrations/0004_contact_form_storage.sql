CREATE TABLE `form_submission_rate_limits` (
	`project_id` text NOT NULL,
	`bucket_key` text NOT NULL,
	`window_ms` integer NOT NULL,
	`window_start` integer NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`project_id`, `bucket_key`, `window_ms`, `window_start`),
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "form_submission_rate_limits_window_positive" CHECK("form_submission_rate_limits"."window_ms" > 0),
	CONSTRAINT "form_submission_rate_limits_count_nonnegative" CHECK("form_submission_rate_limits"."count" >= 0)
);
--> statement-breakpoint
CREATE INDEX `form_submission_rate_limits_window_start_idx` ON `form_submission_rate_limits` (`window_start`);--> statement-breakpoint
-- D1 always enforces foreign keys; deferring them lets the table be rebuilt inside the migration.
PRAGMA defer_foreign_keys = on;--> statement-breakpoint
CREATE TABLE `__new_form_submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`site_version_id` text,
	`form_id` text NOT NULL,
	`form_type` text NOT NULL,
	`payload_version` integer NOT NULL,
	`payload_json` text NOT NULL,
	`status` text DEFAULT 'unread' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`site_version_id`) REFERENCES `site_versions`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "form_submissions_form_id_nonempty" CHECK(length(trim("__new_form_submissions"."form_id")) > 0),
	CONSTRAINT "form_submissions_form_type_nonempty" CHECK(length(trim("__new_form_submissions"."form_type")) > 0),
	CONSTRAINT "form_submissions_payload_version_positive" CHECK("__new_form_submissions"."payload_version" > 0),
	CONSTRAINT "form_submissions_payload_json_object" CHECK(json_valid("__new_form_submissions"."payload_json") and json_type("__new_form_submissions"."payload_json") = 'object'),
	CONSTRAINT "form_submissions_status_valid" CHECK("__new_form_submissions"."status" in ('unread', 'read', 'archived'))
);
--> statement-breakpoint
-- Rows from the column-per-field layout, if any, become contact payloads (version 1). Their block
-- and snapshot are unknown, so form_id gets the `legacy-contact` marker and site_version_id stays null.
INSERT INTO `__new_form_submissions`("id", "project_id", "site_version_id", "form_id", "form_type", "payload_version", "payload_json", "status", "created_at")
SELECT "id", "project_id", NULL, 'legacy-contact', 'contact', 1, json_object('name', "name", 'email', "email", 'message', "message"), "status", "created_at" FROM `form_submissions`;--> statement-breakpoint
DROP TABLE `form_submissions`;--> statement-breakpoint
ALTER TABLE `__new_form_submissions` RENAME TO `form_submissions`;--> statement-breakpoint
PRAGMA defer_foreign_keys = off;--> statement-breakpoint
CREATE INDEX `form_submissions_project_status_created_at_idx` ON `form_submissions` (`project_id`,`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `form_submissions_site_version_id_idx` ON `form_submissions` (`site_version_id`);