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
CREATE INDEX `form_submission_rate_limits_window_start_idx` ON `form_submission_rate_limits` (`window_start`);