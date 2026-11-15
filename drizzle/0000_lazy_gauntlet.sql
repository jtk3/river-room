CREATE TABLE `career_hands` (
	`id` text PRIMARY KEY NOT NULL,
	`table_id` text NOT NULL,
	`hand_number` integer NOT NULL,
	`roster_version` integer NOT NULL,
	`recorded_at` integer NOT NULL,
	`payload` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `career_results` (
	`hand_id` text NOT NULL,
	`player_id` text NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`net` integer NOT NULL,
	PRIMARY KEY(`hand_id`, `player_id`)
);
--> statement-breakpoint
CREATE TABLE `roster` (
	`id` integer PRIMARY KEY NOT NULL,
	`version` integer NOT NULL,
	`data` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `roster_history` (
	`version` integer PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	`updated_at` integer NOT NULL
);
