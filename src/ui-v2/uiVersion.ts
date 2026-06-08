export type UIVersion = "v2";

export function getUIVersion(): UIVersion {
  return "v2";
}

export function setUIVersion(_version: UIVersion) {
  // No-op: v1 has been removed
}

export function useUIVersion(): UIVersion {
  return "v2";
}
