import { getApiClientSync } from "../api/client";
import type { SocialPostData, SocialAccountData, SocialTemplateData } from "../store/types";
import type { GameStateData } from "../store/gameStore";

export async function getSocialFeed(): Promise<SocialPostData[]> {
  return getApiClientSync().social.getFeed() as Promise<SocialPostData[]>;
}

export async function createManagerSocialPost(text: string): Promise<GameStateData> {
  return getApiClientSync().social.createPost({ text });
}

export async function getSocialAccounts(): Promise<SocialAccountData[]> {
  return getApiClientSync().social.getAccounts() as Promise<SocialAccountData[]>;
}

export async function saveSocialAccounts(
  accounts: SocialAccountData[],
): Promise<GameStateData> {
  return getApiClientSync().social.saveAccounts({ accounts });
}

export async function getSocialTemplates(): Promise<SocialTemplateData[]> {
  return getApiClientSync().social.getTemplates() as Promise<SocialTemplateData[]>;
}

export async function saveSocialTemplates(
  templates: SocialTemplateData[],
): Promise<GameStateData> {
  return getApiClientSync().social.saveTemplates({ templates });
}

export async function relocalizeSocialFeed(
  language: string,
): Promise<GameStateData> {
  return getApiClientSync().social.relocalize({ language });
}
