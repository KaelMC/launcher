-- Modrinth account login, friends, shared instances and Modrinth Hosting links
-- have been removed from the app. Convert any data that used them so it still
-- loads, then drop the schema that only they used.

-- Instances linked to a shared instance keep their modpack provenance when there
-- is one; everything else becomes an unmanaged instance.
UPDATE instance_links
SET link_kind = 'modrinth_modpack'
WHERE link_kind = 'shared_instance'
	AND modrinth_project_id IS NOT NULL
	AND modrinth_version_id IS NOT NULL;

UPDATE instance_links
SET link_kind = 'unmanaged'
WHERE link_kind IN ('shared_instance', 'modrinth_hosting');

UPDATE instance_content_sets
SET source_kind = CASE
	WHEN EXISTS (
		SELECT 1 FROM instance_links
		WHERE instance_links.instance_id = instance_content_sets.instance_id
			AND instance_links.link_kind = 'modrinth_modpack'
	) THEN 'modrinth_modpack'
	ELSE 'local'
END
WHERE source_kind IN ('shared_instance', 'modrinth_hosting');

UPDATE instance_content_entries
SET source_kind = 'local'
WHERE source_kind IN ('shared_instance', 'modrinth_hosting');

DELETE FROM install_jobs
WHERE kind IN ('create_shared_instance', 'update_shared_instance');

DROP TABLE instance_content_set_remote_refs;
DROP TABLE instance_content_set_sync_state;

DROP INDEX instance_links_hosting_server_id;
DROP INDEX instance_links_hosting_active_instance_id;
DROP INDEX instance_links_shared_instance_id;

ALTER TABLE instance_links DROP COLUMN hosting_server_id;
ALTER TABLE instance_links DROP COLUMN hosting_instance_ids;
ALTER TABLE instance_links DROP COLUMN hosting_active_instance_id;
ALTER TABLE instance_links DROP COLUMN shared_instance_id;
ALTER TABLE instance_links DROP COLUMN shared_instance_role;
ALTER TABLE instance_links DROP COLUMN shared_instance_manager_id;
ALTER TABLE instance_links DROP COLUMN shared_instance_linked_user_id;
ALTER TABLE instance_links DROP COLUMN shared_instance_server_manager_name;
ALTER TABLE instance_links DROP COLUMN shared_instance_server_manager_icon_url;

-- Modrinth account sessions and the onboarding step that tracked them.
DROP TABLE modrinth_users;

ALTER TABLE onboarding_checklist DROP COLUMN has_logged_into_modrinth;

UPDATE onboarding_checklist
SET show_checklist = FALSE
WHERE has_created_instance = TRUE AND has_logged_into_minecraft = TRUE;
