-- Migration: Rename football_nation to nationality_code and add competitive_region
-- This migration handles the field rename from football_nation to nationality_code
-- and adds the new competitive_region field for LoL regional classification

-- Add nationality_code column (copy from football_nation) and competitive_region to teams
ALTER TABLE teams ADD COLUMN nationality_code TEXT NOT NULL DEFAULT '';
UPDATE teams SET nationality_code = football_nation;

-- Add nationality_code column and competitive_region to managers
ALTER TABLE managers ADD COLUMN nationality_code TEXT NOT NULL DEFAULT '';
ALTER TABLE managers ADD COLUMN competitive_region TEXT NOT NULL DEFAULT '';
UPDATE managers SET nationality_code = football_nation;

-- Add nationality_code column and competitive_region to players
ALTER TABLE players ADD COLUMN nationality_code TEXT NOT NULL DEFAULT '';
ALTER TABLE players ADD COLUMN competitive_region TEXT NOT NULL DEFAULT '';
UPDATE players SET nationality_code = football_nation;

-- Add nationality_code column and competitive_region to staff
ALTER TABLE staff ADD COLUMN nationality_code TEXT NOT NULL DEFAULT '';
ALTER TABLE staff ADD COLUMN competitive_region TEXT NOT NULL DEFAULT '';
UPDATE staff SET nationality_code = football_nation;