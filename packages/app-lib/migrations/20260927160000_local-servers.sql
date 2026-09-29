CREATE TABLE servers (
	id TEXT NOT NULL,
	name TEXT NOT NULL,
	icon_path TEXT NULL,

	loader TEXT NOT NULL,
	loader_version TEXT NULL,
	game_version TEXT NOT NULL,

	jar_path TEXT NULL,
	install_stage TEXT NOT NULL DEFAULT 'not_installed',
	eula_accepted INTEGER NOT NULL DEFAULT 0,

	created INTEGER NOT NULL,
	modified INTEGER NOT NULL,
	last_played INTEGER NULL,

	PRIMARY KEY (id)
);

CREATE INDEX servers_name ON servers(name);
