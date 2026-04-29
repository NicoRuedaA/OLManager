/**
 * Manager avatar utilities
 * 
 * Avatars are stored in app data directory and loaded via Tauri command.
 */

import { invoke } from "@tauri-apps/api/core";

const FALLBACK_MANAGER_AVATAR = "/manager-avatars/default-manager.svg";

/**
 * Resolve the full path to a manager avatar image.
 * Falls back to default avatar if none provided.
 */
export function resolveManagerAvatar(avatarPath?: string | null): string {
  if (!avatarPath) return FALLBACK_MANAGER_AVATAR;
  
  // For public assets (default avatar), return as-is
  if (avatarPath.startsWith("/")) {
    return avatarPath;
  }
  
  // For stored avatars, we need to load via Tauri command
  // This function is synchronous, so we return a placeholder
  // Use loadManagerAvatarData() for async loading
  return FALLBACK_MANAGER_AVATAR;
}

/**
 * Load manager avatar as data URL via Tauri command
 */
export async function loadManagerAvatarData(filename: string): Promise<string> {
  try {
    const dataUrl = await invoke<string>("load_manager_avatar", { filename });
    return dataUrl;
  } catch (error) {
    console.error("Failed to load avatar:", error);
    return FALLBACK_MANAGER_AVATAR;
  }
}

/**
 * Get avatar URL - handles both local and stored avatars
 */
export async function getAvatarUrl(avatarPath?: string | null): Promise<string> {
  if (!avatarPath) return FALLBACK_MANAGER_AVATAR;
  
  // If it's a public asset path, return as-is
  if (avatarPath.startsWith("/")) {
    return avatarPath;
  }
  
  // Otherwise load from app data via Tauri
  return loadManagerAvatarData(avatarPath);
}

/**
 * Generate a unique filename for uploaded avatar
 */
export function generateAvatarFilename(originalName: string): string {
  const ext = originalName.split(".").pop()?.toLowerCase() || "png";
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `manager-${timestamp}-${random}.${ext}`;
}

/**
 * Validate image file for avatar upload
 */
export function validateAvatarFile(file: File): { valid: boolean; error?: string } {
  // Check file type
  if (!file.type.startsWith("image/")) {
    return { valid: false, error: "El archivo debe ser una imagen" };
  }
  
  // Check file size (max 5MB)
  const maxSize = 5 * 1024 * 1024; // 5MB
  if (file.size > maxSize) {
    return { valid: false, error: "La imagen no debe superar los 5MB" };
  }
  
  // Check extension
  const allowedExtensions = ["png", "jpg", "jpeg", "webp", "svg"];
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  if (!allowedExtensions.includes(ext)) {
    return { 
      valid: false, 
      error: "Formato no soportado. Usá PNG, JPG, JPEG, WebP o SVG" 
    };
  }
  
  return { valid: true };
}