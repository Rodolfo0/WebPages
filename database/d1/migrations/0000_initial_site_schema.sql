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
CREATE TABLE `project_members` (
	`project_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role_id` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	PRIMARY KEY(`project_id`, `user_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`,`role_id`) REFERENCES `project_roles`(`project_id`,`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "project_members_status_valid" CHECK("project_members"."status" in ('active', 'inactive'))
);
--> statement-breakpoint
CREATE INDEX `project_members_user_status_project_idx` ON `project_members` (`user_id`,`status`,`project_id`);--> statement-breakpoint
CREATE INDEX `project_members_project_status_role_idx` ON `project_members` (`project_id`,`status`,`role_id`);--> statement-breakpoint
CREATE TABLE `project_permissions` (
	`code` text PRIMARY KEY NOT NULL,
	`description` text NOT NULL,
	`member_grantable` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	CONSTRAINT "project_permissions_member_grantable_valid" CHECK("project_permissions"."member_grantable" in (0, 1))
);
--> statement-breakpoint
CREATE TABLE `project_role_permissions` (
	`project_id` text NOT NULL,
	`role_id` text NOT NULL,
	`permission_code` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	PRIMARY KEY(`project_id`, `role_id`, `permission_code`),
	FOREIGN KEY (`project_id`,`role_id`) REFERENCES `project_roles`(`project_id`,`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`permission_code`) REFERENCES `project_permissions`(`code`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `project_role_permissions_role_idx` ON `project_role_permissions` (`project_id`,`role_id`);--> statement-breakpoint
CREATE TABLE `project_roles` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "project_roles_name_nonempty" CHECK(length(trim("project_roles"."name")) > 0),
	CONSTRAINT "project_roles_kind_valid" CHECK("project_roles"."kind" in ('system_owner', 'custom'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `project_roles_project_id_id_uidx` ON `project_roles` (`project_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `project_roles_project_name_uidx` ON `project_roles` (`project_id`,`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `project_roles_one_system_owner_uidx` ON `project_roles` (`project_id`) WHERE "project_roles"."kind" = 'system_owner';--> statement-breakpoint
CREATE INDEX `project_roles_project_created_at_idx` ON `project_roles` (`project_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`created_by` text NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`draft_document_json` text NOT NULL,
	`published_version_id` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "projects_name_nonempty" CHECK(length(trim("projects"."name")) > 0),
	CONSTRAINT "projects_slug_nonempty" CHECK(length(trim("projects"."slug")) > 0),
	CONSTRAINT "projects_status_valid" CHECK("projects"."status" in ('draft', 'published', 'archived')),
	CONSTRAINT "projects_draft_document_json_valid" CHECK(json_valid("projects"."draft_document_json"))
);
--> statement-breakpoint
CREATE INDEX `projects_created_by_idx` ON `projects` (`created_by`);--> statement-breakpoint
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
INSERT INTO `project_permissions` (`code`, `description`, `member_grantable`) VALUES
	('project:read', 'Consultar el proyecto', 1),
	('project:update', 'Modificar la configuración del proyecto', 1),
	('project:delete', 'Eliminar el proyecto', 0),
	('sharing:manage', 'Administrar el acceso compartido', 0),
	('owners:manage', 'Agregar o quitar owners', 0),
	('assets:read', 'Consultar assets privados', 1),
	('assets:manage', 'Subir o eliminar assets', 1),
	('messages:read', 'Consultar mensajes', 1),
	('messages:manage', 'Organizar o eliminar mensajes', 1),
	('publication:publish', 'Publicar una versión', 1),
	('export:create', 'Generar o descargar una exportación', 1);
--> statement-breakpoint
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
END;--> statement-breakpoint
CREATE TRIGGER `projects_created_by_immutable`
BEFORE UPDATE OF `created_by` ON `projects`
WHEN NEW.`created_by` <> OLD.`created_by`
BEGIN
	SELECT RAISE(ABORT, 'project creator is immutable');
END;--> statement-breakpoint
CREATE TRIGGER `project_roles_identity_immutable`
BEFORE UPDATE OF `project_id`, `kind` ON `project_roles`
WHEN NEW.`project_id` <> OLD.`project_id` OR NEW.`kind` <> OLD.`kind`
BEGIN
	SELECT RAISE(ABORT, 'project role scope and kind are immutable');
END;--> statement-breakpoint
CREATE TRIGGER `project_roles_grant_all_permissions`
AFTER INSERT ON `project_roles`
WHEN NEW.`kind` = 'system_owner'
BEGIN
	INSERT INTO `project_role_permissions` (`project_id`, `role_id`, `permission_code`)
	SELECT NEW.`project_id`, NEW.`id`, `code` FROM `project_permissions`;
END;--> statement-breakpoint
CREATE TRIGGER `project_permissions_grant_to_owners`
AFTER INSERT ON `project_permissions`
BEGIN
	INSERT INTO `project_role_permissions` (`project_id`, `role_id`, `permission_code`)
	SELECT `project_id`, `id`, NEW.`code`
	FROM `project_roles`
	WHERE `kind` = 'system_owner';
END;--> statement-breakpoint
CREATE TRIGGER `project_role_permissions_owner_only_insert`
BEFORE INSERT ON `project_role_permissions`
WHEN (SELECT `member_grantable` FROM `project_permissions`
		WHERE `code` = NEW.`permission_code`) = 0
	AND NOT EXISTS (
		SELECT 1 FROM `project_roles`
		WHERE `id` = NEW.`role_id`
			AND `project_id` = NEW.`project_id`
			AND `kind` = 'system_owner'
	)
BEGIN
	SELECT RAISE(ABORT, 'permission is reserved for project owners');
END;--> statement-breakpoint
CREATE TRIGGER `project_role_permissions_owner_only_update`
BEFORE UPDATE OF `project_id`, `role_id`, `permission_code` ON `project_role_permissions`
WHEN (SELECT `member_grantable` FROM `project_permissions`
		WHERE `code` = NEW.`permission_code`) = 0
	AND NOT EXISTS (
		SELECT 1 FROM `project_roles`
		WHERE `id` = NEW.`role_id`
			AND `project_id` = NEW.`project_id`
			AND `kind` = 'system_owner'
	)
BEGIN
	SELECT RAISE(ABORT, 'permission is reserved for project owners');
END;--> statement-breakpoint
CREATE TRIGGER `project_members_identity_immutable`
BEFORE UPDATE OF `project_id`, `user_id` ON `project_members`
WHEN NEW.`project_id` <> OLD.`project_id` OR NEW.`user_id` <> OLD.`user_id`
BEGIN
	SELECT RAISE(ABORT, 'project membership identity is immutable');
END;--> statement-breakpoint
CREATE TRIGGER `project_members_max_three_owners_insert`
BEFORE INSERT ON `project_members`
WHEN NEW.`status` = 'active'
	AND EXISTS (
		SELECT 1 FROM `project_roles`
		WHERE `id` = NEW.`role_id`
			AND `project_id` = NEW.`project_id`
			AND `kind` = 'system_owner'
	)
	AND (
		SELECT COUNT(*)
		FROM `project_members` AS `members`
		JOIN `project_roles` AS `roles`
			ON `roles`.`id` = `members`.`role_id`
			AND `roles`.`project_id` = `members`.`project_id`
		WHERE `members`.`project_id` = NEW.`project_id`
			AND `members`.`status` = 'active'
			AND `roles`.`kind` = 'system_owner'
	) >= 3
BEGIN
	SELECT RAISE(ABORT, 'project owner limit reached');
END;--> statement-breakpoint
CREATE TRIGGER `project_members_max_three_owners_update`
BEFORE UPDATE OF `project_id`, `role_id`, `status` ON `project_members`
WHEN NEW.`status` = 'active'
	AND EXISTS (
		SELECT 1 FROM `project_roles`
		WHERE `id` = NEW.`role_id`
			AND `project_id` = NEW.`project_id`
			AND `kind` = 'system_owner'
	)
	AND NOT (
		OLD.`project_id` = NEW.`project_id`
		AND OLD.`user_id` = NEW.`user_id`
		AND OLD.`role_id` = NEW.`role_id`
		AND OLD.`status` = 'active'
	)
	AND (
		SELECT COUNT(*)
		FROM `project_members` AS `members`
		JOIN `project_roles` AS `roles`
			ON `roles`.`id` = `members`.`role_id`
			AND `roles`.`project_id` = `members`.`project_id`
		WHERE `members`.`project_id` = NEW.`project_id`
			AND `members`.`user_id` <> OLD.`user_id`
			AND `members`.`status` = 'active'
			AND `roles`.`kind` = 'system_owner'
	) >= 3
BEGIN
	SELECT RAISE(ABORT, 'project owner limit reached');
END;--> statement-breakpoint
CREATE TRIGGER `project_members_preserve_last_owner_update`
BEFORE UPDATE OF `role_id`, `status` ON `project_members`
WHEN OLD.`status` = 'active'
	AND EXISTS (
		SELECT 1 FROM `project_roles`
		WHERE `id` = OLD.`role_id`
			AND `project_id` = OLD.`project_id`
			AND `kind` = 'system_owner'
	)
	AND (NEW.`status` <> 'active' OR NEW.`role_id` <> OLD.`role_id`)
	AND NOT EXISTS (
		SELECT 1
		FROM `project_members` AS `members`
		JOIN `project_roles` AS `roles`
			ON `roles`.`id` = `members`.`role_id`
			AND `roles`.`project_id` = `members`.`project_id`
		WHERE `members`.`project_id` = OLD.`project_id`
			AND `members`.`user_id` <> OLD.`user_id`
			AND `members`.`status` = 'active'
			AND `roles`.`kind` = 'system_owner'
	)
BEGIN
	SELECT RAISE(ABORT, 'a project must keep at least one owner');
END;--> statement-breakpoint
CREATE TRIGGER `project_members_preserve_last_owner_delete`
BEFORE DELETE ON `project_members`
WHEN OLD.`status` = 'active'
	AND EXISTS (SELECT 1 FROM `projects` WHERE `id` = OLD.`project_id`)
	AND EXISTS (
		SELECT 1 FROM `project_roles`
		WHERE `id` = OLD.`role_id`
			AND `project_id` = OLD.`project_id`
			AND `kind` = 'system_owner'
	)
	AND NOT EXISTS (
		SELECT 1
		FROM `project_members` AS `members`
		JOIN `project_roles` AS `roles`
			ON `roles`.`id` = `members`.`role_id`
			AND `roles`.`project_id` = `members`.`project_id`
		WHERE `members`.`project_id` = OLD.`project_id`
			AND `members`.`user_id` <> OLD.`user_id`
			AND `members`.`status` = 'active'
			AND `roles`.`kind` = 'system_owner'
	)
BEGIN
	SELECT RAISE(ABORT, 'a project must keep at least one owner');
END;
