// Frontend client for the native OLMDBManager auto-import (Tauri commands in
// `src-tauri/src/commands/import.rs`). Downloads and extracts the public
// OLMDBManager export into the writable app-data dir; the competition loaders
// then prefer that data and the `olm-asset://` protocol serves its photos.

import { invoke } from "@tauri-apps/api/core";

export interface ImportSummary {
  data_files: number;
  photo_files: number;
  player_count: number;
  team_count: number;
  staff_count: number;
  skipped: number;
}

export interface ImportProgress {
  phase: "downloading" | "downloaded" | "reading" | "extracting" | "installing" | "done" | string;
  message: string;
  processed: number;
  total: number | null;
}

export interface ImportCacheInfo {
  exists: boolean;
  path: string;
  size_bytes: number;
}

export interface CatalogPlayer {
  id: string;
  name: string;
  full_name: string;
  team_id: string | null;
  nationality: string | null;
  role: string | null;
  image_url: string | null;
}

export interface CatalogTeam {
  id: string;
  name: string;
  short_name: string | null;
  country: string | null;
  competition_id: string | null;
  logo_url: string | null;
}

export interface CatalogStaff {
  id: string;
  name: string;
  role: string | null;
  team_id: string | null;
  nationality: string | null;
  image_url: string | null;
}

export interface CatalogResponse {
  summary: ImportSummary;
  players: CatalogPlayer[];
  teams: CatalogTeam[];
  staff: CatalogStaff[];
}

/** Download the configured public OLMDBManager export and import it locally. */
export function autoImportDatabase(): Promise<ImportSummary> {
  return invoke<ImportSummary>("auto_import_database");
}

/** Import a local OLMDBManager export zip from an absolute path. */
export function importExportZip(path: string): Promise<ImportSummary> {
  return invoke<ImportSummary>("import_export_zip", { path });
}

/** Re-import the last successfully imported ZIP from local app-data cache. */
export function importCachedExport(): Promise<ImportSummary> {
  return invoke<ImportSummary>("import_cached_export");
}

/** Metadata for the locally cached export ZIP, if one exists. */
export function getImportCacheInfo(): Promise<ImportCacheInfo> {
  return invoke<ImportCacheInfo>("get_import_cache_info");
}

/** Counts of the currently imported catalog (zeros if nothing imported yet). */
export function getCatalogSummary(): Promise<ImportSummary> {
  return invoke<ImportSummary>("get_catalog_summary");
}

/** Full imported catalog (players/teams/staff) for the Settings browser. */
export function getCatalog(): Promise<CatalogResponse> {
  return invoke<CatalogResponse>("get_catalog");
}
