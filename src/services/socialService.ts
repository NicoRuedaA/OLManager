import { invoke } from "@tauri-apps/api/core";
import type { SocialPostData } from "../store/types";
import type { GameStateData } from "../store/gameStore";
import type { SocialAccountData, SocialTemplateData } from "../store/types";

export async function getSocialFeed(): Promise<SocialPostData[]> {
  return invoke<SocialPostData[]>("get_social_feed");
}

export async function createManagerSocialPost(text: string): Promise<GameStateData> {
  return invoke<GameStateData>("create_manager_social_post", { text });
}

export async function getSocialAccounts(): Promise<SocialAccountData[]> {
  return invoke<SocialAccountData[]>("get_social_accounts");
}

export async function saveSocialAccounts(
  accounts: SocialAccountData[],
): Promise<GameStateData> {
  return invoke<GameStateData>("save_social_accounts", { accounts });
}

export async function getSocialTemplates(): Promise<SocialTemplateData[]> {
  return invoke<SocialTemplateData[]>("get_social_templates");
}

export async function saveSocialTemplates(
  templates: SocialTemplateData[],
): Promise<GameStateData> {
  return invoke<GameStateData>("save_social_templates", { templates });
}

export async function relocalizeSocialFeed(
  language: string,
): Promise<GameStateData> {
  return invoke<GameStateData>("relocalize_social_feed", { language });
}
