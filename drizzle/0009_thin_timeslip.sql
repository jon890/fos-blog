CREATE TABLE `glossary_mentions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`term_id` varchar(128) NOT NULL,
	`page_type` varchar(32) NOT NULL,
	`page_path` varchar(500) NOT NULL,
	`page_title` varchar(500) NOT NULL,
	`page_updated_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `glossary_mentions_id` PRIMARY KEY(`id`),
	CONSTRAINT `glossary_mentions_term_page_unique` UNIQUE(`term_id`,`page_type`,`page_path`)
);
--> statement-breakpoint
CREATE TABLE `glossary_terms` (
	`id` varchar(128) NOT NULL,
	`term` varchar(255) NOT NULL,
	`full_name` varchar(500),
	`aliases` json NOT NULL DEFAULT ('[]'),
	`summary` text NOT NULL,
	`description` text NOT NULL,
	`case_sensitive` boolean NOT NULL DEFAULT false,
	`references` json NOT NULL DEFAULT ('[]'),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `glossary_terms_id` PRIMARY KEY(`id`),
	CONSTRAINT `glossary_terms_term_unique` UNIQUE(`term`)
);
--> statement-breakpoint
ALTER TABLE `glossary_mentions` ADD CONSTRAINT `glossary_mentions_term_id_glossary_terms_id_fk` FOREIGN KEY (`term_id`) REFERENCES `glossary_terms`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `glossary_mentions_term_updated_idx` ON `glossary_mentions` (`term_id`,`page_updated_at`);