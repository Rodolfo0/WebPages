ALTER TABLE `assets` ADD `uploaded_by_user_id` text REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict;
--> statement-breakpoint
CREATE INDEX `assets_uploaded_by_user_id_idx` ON `assets` (`uploaded_by_user_id`);
