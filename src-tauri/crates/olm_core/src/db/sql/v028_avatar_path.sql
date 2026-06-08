-- V28: Add avatar_path column to managers table for profile avatar persistence.

ALTER TABLE managers ADD COLUMN avatar_path TEXT;