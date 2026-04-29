# Manager Avatar Feature

## Overview

The manager avatar feature allows players to upload a custom profile picture when creating a new manager career. This feature includes:

- Image upload with validation (file type, size, extension)
- Avatar storage in app data directory via Tauri commands
- Avatar display in the manager profile tab
- Fallback to default silhouette when no avatar is set

## File Structure

### Frontend

| File | Purpose |
|------|---------|
| `src/lib/managerAvatars.ts` | Utility functions for avatar handling |
| `public/manager-avatars/default-manager.svg` | Default avatar fallback |

### Backend (Rust/Tauri)

| File | Purpose |
|------|---------|
| `src-tauri/crates/domain/src/manager.rs` | Added `avatar_path` field to Manager struct |
| `src-tauri/src/commands/game.rs` | Added `save_manager_avatar` and `load_manager_avatar` commands |
| `src-tauri/src/lib.rs` | Registered new Tauri commands |
| `src-tauri/crates/db/src/repositories/manager_repo.rs` | Updated Manager struct construction |

## Implementation Details

### Avatar Upload Flow

1. User selects an image file in MainMenu.tsx
2. File is validated (type, size, extension)
3. On game start, file is converted to bytes and uploaded via Tauri
4. Tauri saves the file to `app_data_dir/manager-avatars/`
5. Avatar path is stored in the Manager struct

### Avatar Display Flow

1. ManagerTab.tsx loads avatar asynchronously via `getAvatarUrl()`
2. If avatar_path exists, loads from app data via `load_manager_avatar` command
3. Returns base64 data URL for display
4. Falls back to default SVG if loading fails

### Supported Formats

- PNG
- JPEG/JPG
- WebP
- SVG

### File Size Limit

- Maximum: 5MB

### Storage Location

- Windows: `%APPDATA%\com.openleaguemanager\manager-avatars\`
- The avatar filename is generated with timestamp + random string to ensure uniqueness

## Database Schema

The Manager struct now includes an optional `avatar_path` field that stores the filename of the uploaded avatar (not the full path). This is persisted in the database with the manager record.

## Testing Considerations

- Test avatar upload with various file types
- Test file size validation (should reject files > 5MB)
- Test avatar display after loading a saved game
- Test fallback display when no avatar is set
- Test that avatar persists across game saves