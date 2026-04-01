CREATE TABLE `categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`slug` varchar(255) NOT NULL,
	`icon` varchar(50),
	`post_count` int NOT NULL DEFAULT 0,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `categories_id` PRIMARY KEY(`id`),
	CONSTRAINT `categories_name_unique` UNIQUE(`name`),
	CONSTRAINT `categories_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `folders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`path` varchar(500) NOT NULL,
	`readme` text,
	`sha` varchar(64),
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `folders_id` PRIMARY KEY(`id`),
	CONSTRAINT `folders_path_unique` UNIQUE(`path`)
);
--> statement-breakpoint
CREATE TABLE `posts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(500) NOT NULL,
	`path` varchar(500) NOT NULL,
	`slug` varchar(500) NOT NULL,
	`category` varchar(255) NOT NULL,
	`subcategory` varchar(255),
	`folders` json DEFAULT ('[]'),
	`content` text,
	`description` text,
	`sha` varchar(64),
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `posts_id` PRIMARY KEY(`id`),
	CONSTRAINT `posts_path_unique` UNIQUE(`path`)
);
--> statement-breakpoint
CREATE TABLE `sync_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`status` varchar(50) NOT NULL,
	`posts_added` int DEFAULT 0,
	`posts_updated` int DEFAULT 0,
	`posts_deleted` int DEFAULT 0,
	`commit_sha` varchar(64),
	`error` text,
	`synced_at` timestamp DEFAULT (now()),
	CONSTRAINT `sync_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `slug_idx` ON `categories` (`slug`);--> statement-breakpoint
CREATE INDEX `path_idx` ON `folders` (`path`);--> statement-breakpoint
CREATE INDEX `category_idx` ON `posts` (`category`);--> statement-breakpoint
CREATE INDEX `slug_idx` ON `posts` (`slug`);