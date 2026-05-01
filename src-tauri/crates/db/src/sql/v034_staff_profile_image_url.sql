-- V34: Add profile_image_url column to staff table
-- Old saves don't have this column, causing load_all_staff to fail
-- Add it with NULL default for backwards compatibility

ALTER TABLE staff ADD COLUMN profile_image_url TEXT;