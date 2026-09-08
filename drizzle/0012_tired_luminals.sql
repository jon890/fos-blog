CREATE TABLE `study_material_sources` (
	`material_id` int unsigned NOT NULL,
	`source_key` varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
	`collected_at` datetime(3) NOT NULL,
	CONSTRAINT `study_material_sources_material_id_source_key_pk` PRIMARY KEY(`material_id`,`source_key`)
);
--> statement-breakpoint
CREATE TABLE `study_material_states` (
	`owner_key` varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
	`material_id` int unsigned NOT NULL,
	`starred` boolean NOT NULL,
	`read` boolean NOT NULL,
	`note` text NOT NULL,
	`version` int unsigned NOT NULL,
	`updated_at` datetime(3) NOT NULL,
	CONSTRAINT `study_material_states_owner_key_material_id_pk` PRIMARY KEY(`owner_key`,`material_id`)
);
--> statement-breakpoint
CREATE TABLE `study_material_tags` (
	`material_id` int unsigned NOT NULL,
	`tag` varchar(50) NOT NULL,
	CONSTRAINT `study_material_tags_material_id_tag_pk` PRIMARY KEY(`material_id`,`tag`)
);
--> statement-breakpoint
CREATE TABLE `study_materials` (
	`id` int unsigned AUTO_INCREMENT NOT NULL,
	`content_key` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
	`canonical_url` varchar(2048) NOT NULL,
	`url` varchar(2048) NOT NULL,
	`title` varchar(500) NOT NULL,
	`published` varchar(128) NOT NULL,
	`published_at` datetime(3),
	`excerpt` text,
	`kind` varchar(16) NOT NULL,
	`collected_at` datetime(3) NOT NULL,
	`created_at` datetime(3) NOT NULL,
	CONSTRAINT `study_materials_id` PRIMARY KEY(`id`),
	CONSTRAINT `study_materials_content_key_unique` UNIQUE(`content_key`)
);
--> statement-breakpoint
CREATE TABLE `study_publications` (
	`id` int unsigned AUTO_INCREMENT NOT NULL,
	`run_id` int unsigned NOT NULL,
	`channel` varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
	`published_at` datetime(3) NOT NULL,
	`external_id` varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
	`url` varchar(2048),
	`request_hash` char(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
	CONSTRAINT `study_publications_id` PRIMARY KEY(`id`),
	CONSTRAINT `study_publications_run_channel_external_unique` UNIQUE(`run_id`,`channel`,`external_id`)
);
--> statement-breakpoint
CREATE TABLE `study_recommendation_control` (
	`owner_key` varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
	`history_version` int unsigned NOT NULL,
	`latest_run_id` int unsigned,
	CONSTRAINT `study_recommendation_control_owner_key` PRIMARY KEY(`owner_key`)
);
--> statement-breakpoint
CREATE TABLE `study_recommendation_items` (
	`id` int unsigned AUTO_INCREMENT NOT NULL,
	`run_id` int unsigned NOT NULL,
	`topic_id` int unsigned NOT NULL,
	`position` int unsigned NOT NULL,
	`material_id` int unsigned NOT NULL,
	`title` varchar(500) NOT NULL,
	`canonical_url` varchar(2048) NOT NULL,
	`summary` varchar(300),
	`reason` varchar(300),
	`career_value` varchar(32),
	CONSTRAINT `study_recommendation_items_id` PRIMARY KEY(`id`),
	CONSTRAINT `study_recommendation_items_run_material_unique` UNIQUE(`run_id`,`material_id`),
	CONSTRAINT `study_recommendation_items_topic_position_unique` UNIQUE(`topic_id`,`position`)
);
--> statement-breakpoint
CREATE TABLE `study_recommendation_runs` (
	`id` int unsigned AUTO_INCREMENT NOT NULL,
	`report_id` varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
	`generated_at` datetime(3) NOT NULL,
	`committed_at` datetime(3) NOT NULL,
	`request_hash` char(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
	`history_version` int unsigned NOT NULL,
	`origin` varchar(8) NOT NULL,
	CONSTRAINT `study_recommendation_runs_id` PRIMARY KEY(`id`),
	CONSTRAINT `study_recommendation_runs_report_id_unique` UNIQUE(`report_id`)
);
--> statement-breakpoint
CREATE TABLE `study_recommendation_topics` (
	`id` int unsigned AUTO_INCREMENT NOT NULL,
	`run_id` int unsigned NOT NULL,
	`position` int unsigned NOT NULL,
	`topic_key` varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
	`title` varchar(300) NOT NULL,
	`career_question` varchar(300),
	CONSTRAINT `study_recommendation_topics_id` PRIMARY KEY(`id`),
	CONSTRAINT `study_recommendation_topics_id_run_unique` UNIQUE(`id`,`run_id`),
	CONSTRAINT `study_recommendation_topics_run_key_unique` UNIQUE(`run_id`,`topic_key`),
	CONSTRAINT `study_recommendation_topics_run_position_unique` UNIQUE(`run_id`,`position`)
);
--> statement-breakpoint
CREATE TABLE `study_recommended_materials` (
	`owner_key` varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
	`material_id` int unsigned NOT NULL,
	`first_run_id` int unsigned NOT NULL,
	CONSTRAINT `study_recommended_materials_owner_key_material_id_pk` PRIMARY KEY(`owner_key`,`material_id`)
);
--> statement-breakpoint
CREATE TABLE `study_request_receipts` (
	`operation` varchar(16) NOT NULL,
	`request_key` varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
	`request_hash` char(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
	`response` json NOT NULL,
	`created_at` datetime(3) NOT NULL,
	CONSTRAINT `study_request_receipts_operation_request_key_pk` PRIMARY KEY(`operation`,`request_key`)
);
--> statement-breakpoint
CREATE TABLE `study_source_cursors` (
	`source_key` varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
	`mode` varchar(8) NOT NULL,
	`cursor` json,
	`version` int unsigned NOT NULL,
	`updated_at` datetime(3) NOT NULL,
	CONSTRAINT `study_source_cursors_source_key_mode_pk` PRIMARY KEY(`source_key`,`mode`)
);
--> statement-breakpoint
CREATE TABLE `study_sources` (
	`source_key` varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
	`title` varchar(500) NOT NULL,
	`category` varchar(16) NOT NULL,
	`url` varchar(2048),
	`feed_url` varchar(2048),
	`adapter` varchar(16) NOT NULL,
	`enabled` boolean NOT NULL,
	`version` int unsigned NOT NULL,
	`updated_at` datetime(3) NOT NULL,
	CONSTRAINT `study_sources_source_key` PRIMARY KEY(`source_key`)
);
--> statement-breakpoint
ALTER TABLE `study_material_sources` ADD CONSTRAINT `study_material_sources_material_fk` FOREIGN KEY (`material_id`) REFERENCES `study_materials`(`id`) ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE `study_material_sources` ADD CONSTRAINT `study_material_sources_source_fk` FOREIGN KEY (`source_key`) REFERENCES `study_sources`(`source_key`) ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE `study_material_states` ADD CONSTRAINT `study_material_states_material_fk` FOREIGN KEY (`material_id`) REFERENCES `study_materials`(`id`) ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE `study_material_tags` ADD CONSTRAINT `study_material_tags_material_fk` FOREIGN KEY (`material_id`) REFERENCES `study_materials`(`id`) ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE `study_publications` ADD CONSTRAINT `study_publications_run_fk` FOREIGN KEY (`run_id`) REFERENCES `study_recommendation_runs`(`id`) ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE `study_recommendation_control` ADD CONSTRAINT `study_control_latest_run_fk` FOREIGN KEY (`latest_run_id`) REFERENCES `study_recommendation_runs`(`id`) ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE `study_recommendation_items` ADD CONSTRAINT `study_recommendation_items_topic_run_fk` FOREIGN KEY (`topic_id`,`run_id`) REFERENCES `study_recommendation_topics`(`id`,`run_id`) ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE `study_recommendation_items` ADD CONSTRAINT `study_items_run_fk` FOREIGN KEY (`run_id`) REFERENCES `study_recommendation_runs`(`id`) ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE `study_recommendation_items` ADD CONSTRAINT `study_items_material_fk` FOREIGN KEY (`material_id`) REFERENCES `study_materials`(`id`) ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE `study_recommendation_topics` ADD CONSTRAINT `study_topics_run_fk` FOREIGN KEY (`run_id`) REFERENCES `study_recommendation_runs`(`id`) ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE `study_recommended_materials` ADD CONSTRAINT `study_recommended_material_fk` FOREIGN KEY (`material_id`) REFERENCES `study_materials`(`id`) ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE `study_recommended_materials` ADD CONSTRAINT `study_recommended_first_run_fk` FOREIGN KEY (`first_run_id`) REFERENCES `study_recommendation_runs`(`id`) ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE `study_source_cursors` ADD CONSTRAINT `study_cursors_source_fk` FOREIGN KEY (`source_key`) REFERENCES `study_sources`(`source_key`) ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
CREATE INDEX `study_material_sources_source_material_idx` ON `study_material_sources` (`source_key`,`material_id`);--> statement-breakpoint
CREATE INDEX `study_materials_published_at_id_idx` ON `study_materials` (`published_at`,`id`);