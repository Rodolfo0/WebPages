CREATE TABLE `assets` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`r2_key` text NOT NULL,
	`filename` text NOT NULL,
	`content_type` text NOT NULL,
	`byte_size` integer NOT NULL,
	`alt_text` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "assets_byte_size_positive" CHECK("assets"."byte_size" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `assets_r2_key_uidx` ON `assets` (`r2_key`);--> statement-breakpoint
CREATE INDEX `assets_project_created_at_idx` ON `assets` (`project_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `form_submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`message` text NOT NULL,
	`status` text DEFAULT 'unread' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "form_submissions_name_nonempty" CHECK(length(trim("form_submissions"."name")) > 0),
	CONSTRAINT "form_submissions_email_nonempty" CHECK(length(trim("form_submissions"."email")) > 0),
	CONSTRAINT "form_submissions_message_nonempty" CHECK(length(trim("form_submissions"."message")) > 0),
	CONSTRAINT "form_submissions_status_valid" CHECK("form_submissions"."status" in ('unread', 'read', 'archived'))
);
--> statement-breakpoint
CREATE INDEX `form_submissions_project_status_created_at_idx` ON `form_submissions` (`project_id`,`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`draft_document_json` text NOT NULL,
	`published_version_id` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "projects_name_nonempty" CHECK(length(trim("projects"."name")) > 0),
	CONSTRAINT "projects_slug_nonempty" CHECK(length(trim("projects"."slug")) > 0),
	CONSTRAINT "projects_status_valid" CHECK("projects"."status" in ('draft', 'published', 'archived')),
	CONSTRAINT "projects_draft_document_json_valid" CHECK(json_valid("projects"."draft_document_json"))
);
--> statement-breakpoint
CREATE INDEX `projects_owner_id_idx` ON `projects` (`owner_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `projects_slug_uidx` ON `projects` (`slug`);--> statement-breakpoint
CREATE INDEX `projects_status_created_at_idx` ON `projects` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `projects_created_at_idx` ON `projects` (`created_at`);--> statement-breakpoint
CREATE TABLE `site_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`document_json` text NOT NULL,
	`document_version` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`published_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "site_versions_document_json_valid" CHECK(json_valid("site_versions"."document_json")),
	CONSTRAINT "site_versions_document_version_positive" CHECK("site_versions"."document_version" > 0)
);
--> statement-breakpoint
CREATE INDEX `site_versions_project_created_at_idx` ON `site_versions` (`project_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`auth_subject` text NOT NULL,
	`email` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_auth_subject_uidx` ON `users` (`auth_subject`);--> statement-breakpoint
CREATE INDEX `users_email_idx` ON `users` (`email`);--> statement-breakpoint
CREATE TRIGGER `site_versions_immutable_update`
BEFORE UPDATE ON `site_versions`
BEGIN
	SELECT RAISE(ABORT, 'published site versions are immutable');
END;--> statement-breakpoint
CREATE TRIGGER `projects_published_version_owner_insert`
BEFORE INSERT ON `projects`
WHEN NEW.`published_version_id` IS NOT NULL
	AND NOT EXISTS (
		SELECT 1 FROM `site_versions`
		WHERE `site_versions`.`id` = NEW.`published_version_id`
			AND `site_versions`.`project_id` = NEW.`id`
	)
BEGIN
	SELECT RAISE(ABORT, 'published version must belong to its project');
END;--> statement-breakpoint
CREATE TRIGGER `projects_published_version_owner_update`
BEFORE UPDATE OF `published_version_id` ON `projects`
WHEN NEW.`published_version_id` IS NOT NULL
	AND NOT EXISTS (
		SELECT 1 FROM `site_versions`
		WHERE `site_versions`.`id` = NEW.`published_version_id`
			AND `site_versions`.`project_id` = NEW.`id`
	)
BEGIN
	SELECT RAISE(ABORT, 'published version must belong to its project');
END;
