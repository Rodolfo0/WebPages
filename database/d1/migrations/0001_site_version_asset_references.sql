ALTER TABLE `site_versions`
	ADD COLUMN `referenced_asset_ids_json` text DEFAULT '[]' NOT NULL
	CONSTRAINT `site_versions_referenced_asset_ids_json_array`
	CHECK(json_valid(`referenced_asset_ids_json`) AND json_type(`referenced_asset_ids_json`) = 'array');
