-- V33: Add profile_image_url to players (already handled by V29 hook migrate_profile_image_urls)
-- This is a no-op because the column was already added by the hook in V29.
-- The separate v033 SQL file was created in error and is not referenced.
SELECT 1;