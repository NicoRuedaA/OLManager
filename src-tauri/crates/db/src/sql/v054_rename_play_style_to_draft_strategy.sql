-- V054: Rename play_style column to draft_strategy
-- Uses CREATE/INSERT/DROP/RENAME pattern (see V042, V053)

-- Step 1: Create a temporary column with the new name
ALTER TABLE teams ADD COLUMN draft_strategy TEXT NOT NULL DEFAULT 'Balanced';

-- Step 2: Copy values from the old column to the new column
UPDATE teams SET draft_strategy = play_style;

-- Step 3: Drop the old column
ALTER TABLE teams DROP COLUMN play_style;
