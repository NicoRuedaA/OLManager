-- V40: Cleanup football legacy columns in teams table (if safe).
-- This is a no-op SQL — the actual migration is handled by the
-- migrate_cleanup_teams_legacy hook, which audits whether columns
-- like formation, wage_budget, transfer_budget, season_income,
-- season_expenses, training_intensity, training_schedule have
-- meaningful data before removing them.
SELECT 1;