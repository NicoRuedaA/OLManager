import { useSyncExternalStore } from "react";

export type UIVersion = "v1" | "v2";

const STORAGE_KEY = "olmanager_ui_version";
const EVENT_NAME = "ui-version-change";

export function getUIVersion(): UIVersion {
  if (typeof localStorage === "undefined") return "v1";
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === "v2" ? "v2" : "v1";
}

export function setUIVersion(version: UIVersion) {
  localStorage.setItem(STORAGE_KEY, version);
  window.dispatchEvent(new Event(EVENT_NAME));
}

function subscribe(callback: () => void) {
  window.addEventListener(EVENT_NAME, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(EVENT_NAME, callback);
    window.removeEventListener("storage", callback);
  };
}

export function useUIVersion(): UIVersion {
  return useSyncExternalStore(subscribe, getUIVersion, () => "v1");
}
