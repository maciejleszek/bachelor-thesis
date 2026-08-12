import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";

const STORAGE_KEY = "health-monitor:api-url";

const DEFAULT_BASE =
  process.env.EXPO_PUBLIC_API_URL ||
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ||
  "http://localhost:8000";

let cachedBase: string | null = null;

export async function getApiUrl(): Promise<string> {
  if (cachedBase) return cachedBase;
  const stored = await AsyncStorage.getItem(STORAGE_KEY);
  const resolved = stored ?? DEFAULT_BASE;
  cachedBase = resolved;
  return resolved;
}

export async function setApiUrl(url: string): Promise<void> {
  const trimmed = url.trim().replace(/\/+$/, "");
  cachedBase = trimmed;
  await AsyncStorage.setItem(STORAGE_KEY, trimmed);
}

export async function getDefaultApiUrl(): Promise<string> {
  return DEFAULT_BASE;
}

async function request<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const base = await getApiUrl();
  const res = await fetch(`${base}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${path} ${body}`.trim());
  }
  if (res.status === 204) return null as T;
  return res.json();
}

function qs(params: Record<string, unknown> = {}): string {
  const clean: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") clean[k] = String(v);
  }
  const s = new URLSearchParams(clean).toString();
  return s ? `?${s}` : "";
}

export const http = { request, qs };
