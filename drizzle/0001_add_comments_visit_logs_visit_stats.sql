CREATE TABLE `comments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`post_slug` varchar(500) NOT NULL,
	`nickname` varchar(100) NOT NULL,
	`password` varchar(255) NOT NULL,
	`content` text NOT NULL,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `comments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `visit_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`page_path` varchar(500) NOT NULL,
	`ip_hash` varchar(64) NOT NULL,
	`visited_date` date NOT NULL,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `visit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `visit_stats` (
	`id` int AUTO_INCREMENT NOT NULL,
	`page_path` varchar(500) NOT NULL,
	`visit_count` int NOT NULL DEFAULT 0,
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `visit_stats_id` PRIMARY KEY(`id`),
	CONSTRAINT `visit_stats_page_path_idx` UNIQUE(`page_path`)
);
--> statement-breakpoint
CREATE INDEX `post_slug_idx` ON `comments` (`post_slug`);--> statement-breakpoint
CREATE INDEX `visit_page_ip_date_idx` ON `visit_logs` (`page_path`,`ip_hash`,`visited_date`);