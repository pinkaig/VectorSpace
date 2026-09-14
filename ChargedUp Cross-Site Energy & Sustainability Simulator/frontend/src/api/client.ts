import type { Site } from "../types/api";

const baseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

export async function fetchSites(): Promise<Site[]> {
  const response = await fetch(`${baseUrl}/api/sites`);
  if (!response.ok) throw new Error("Unable to load sites");
  return response.json() as Promise<Site[]>;
}
