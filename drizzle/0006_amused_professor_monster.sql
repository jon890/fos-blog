ALTER TABLE `posts` ADD `series` varchar(255);--> statement-breakpoint
ALTER TABLE `posts` ADD `series_order` int;--> statement-breakpoint
CREATE INDEX `series_idx` ON `posts` (`series`);