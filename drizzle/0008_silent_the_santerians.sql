ALTER TABLE `posts` ADD `categories` json DEFAULT ('[]') NOT NULL;
--> statement-breakpoint
UPDATE `posts` SET `categories` = JSON_ARRAY(`category`) WHERE JSON_LENGTH(`categories`) = 0;