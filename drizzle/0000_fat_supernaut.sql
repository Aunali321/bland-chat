CREATE TABLE `conversations` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text DEFAULT 'New chat' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`position` integer NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`reasoning` text,
	`metrics` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`id` text PRIMARY KEY DEFAULT 'default' NOT NULL,
	`api_url` text DEFAULT '' NOT NULL,
	`api_key` text DEFAULT '' NOT NULL,
	`model` text DEFAULT '' NOT NULL,
	`system_prompt` text DEFAULT 'You are a helpful assistant.' NOT NULL,
	`temperature` real DEFAULT 1 NOT NULL,
	`max_tokens` integer DEFAULT 4096 NOT NULL,
	`top_p` real DEFAULT 0.95 NOT NULL,
	`top_k` integer DEFAULT 20 NOT NULL,
	`min_p` real DEFAULT 0 NOT NULL,
	`presence_penalty` real DEFAULT 1.5 NOT NULL,
	`repetition_penalty` real DEFAULT 1 NOT NULL
);
