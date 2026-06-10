-- V56: Add nickname column to staff (esports handle, e.g. "Zetz", "ZalFIRE").
-- The OLMDBManager export carries a `nickname` per staff member; without this
-- column it was dropped on persist and the UI fell back to the real name.
ALTER TABLE staff ADD COLUMN nickname TEXT NOT NULL DEFAULT '';
